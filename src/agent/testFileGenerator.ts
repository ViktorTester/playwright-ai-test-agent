import {z} from "zod";
import {createOpenAiClient} from "../ai/openAiClient";
import type {TestCaseGenerationResult} from "./testCaseGenerator";
import {getPomMethodContract, getPomVariableNames, renderPomApiContract} from "./pomContract";

const GeneratedTestFileSchema = z.object({
    filePath: z.literal("tests/generated/saucedemo-ai-generated.spec.ts"),
    code: z.string().min(1),
});

export type GeneratedTestFile = z.infer<typeof GeneratedTestFileSchema>;

export async function generatePlaywrightTestFile(
    testCaseGenerationResult: TestCaseGenerationResult,
): Promise<GeneratedTestFile> {
    const maxAttempts = 3;
    const validationErrors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const generatedTestFile = await generatePlaywrightTestFileAttempt(
            testCaseGenerationResult,
            validationErrors,
        );

        try {
            assertGeneratedCodeLooksSafe(generatedTestFile.code);
            assertGeneratedCodeUsesOnlyKnownPomApi(generatedTestFile.code);

            return generatedTestFile;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            validationErrors.push(message);

            if (attempt === maxAttempts) {
                throw new Error(
                    [
                        "AI generated invalid Playwright test code after all attempts.",
                        ...validationErrors.map((validationError, index) => `${index + 1}. ${validationError}`),
                    ].join("\n"),
                );
            }
        }
    }

    throw new Error("AI generated invalid Playwright test code.");
}

async function generatePlaywrightTestFileAttempt(
    testCaseGenerationResult: TestCaseGenerationResult,
    previousValidationErrors: string[],
): Promise<GeneratedTestFile> {
    const openai = createOpenAiClient();
    const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

    const response = await openai.responses.create({
        model,
        input: [
            {
                role: "system",
                content: [
                    "You are a senior QA automation engineer specialized in Playwright and TypeScript.",
                    "Generate stable, maintainable Playwright tests from the provided test cases.",
                    "Use only the Page Object Model API contract provided by the user.",
                    "Do not invent POM methods.",
                    "Do not change POM method names.",
                    "Do not pass arguments to methods unless the POM API contract says they accept arguments.",
                    "Do not use hard waits, force clicks, brittle CSS/XPath selectors, or excessive retries.",
                    "Return only valid JSON.",
                    "Do not wrap the JSON in markdown.",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    "Generate one Playwright spec file for SauceDemo.",
                    "The generated file must compile with TypeScript without any manual fixes.",
                    "If a test case cannot be implemented using the POM API contract, skip that test case.",
                    "",
                    "The output must be JSON with exactly this structure:",
                    JSON.stringify(
                        {
                            filePath: "tests/generated/saucedemo-ai-generated.spec.ts",
                            code: "TypeScript Playwright spec file content here",
                        },
                        null,
                        2,
                    ),
                    "",
                    renderPomApiContract(),
                    "",
                    "Rules:",
                    "- Use import {test} from \"@playwright/test\";",
                    "- Use double quotes for imports and string literals.",
                    "- Do not import expect.",
                    "- Do not use test.step in generated tests.",
                    "- Step reporting is handled inside POM methods by @step decorators.",
                    "- Add @smoke or @regression tags based on the test case type.",
                    "- Use standard_user / secret_sauce for successful login.",
                    "- Use locked_out_user / secret_sauce for locked out login validation.",
                    "- Keep tests independent.",
                    "- Do not assert raw UI locators directly in tests.",
                    "- Do not use page.locator, getByRole, getByText, or getByPlaceholder inside generated tests.",
                    "- Do not add comments explaining the code.",
                    "",
                    "Previous validation errors that must be fixed:",
                    previousValidationErrors.length > 0
                        ? previousValidationErrors.map((error, index) => `${index + 1}. ${error}`).join("\n")
                        : "None",
                    "",
                    "Example of correct style:",
                    "import {test} from \"@playwright/test\";",
                    "import {LoginPage} from \"../../src/pages/LoginPage\";",
                    "import {InventoryPage} from \"../../src/pages/InventoryPage\";",
                    "",
                    "test(\"@smoke valid user can log in\", async ({page}) => {",
                    "    const loginPage = new LoginPage(page);",
                    "    const inventoryPage = new InventoryPage(page);",
                    "",
                    "    await loginPage.open();",
                    "    await loginPage.expectLoaded();",
                    "    await loginPage.login(\"standard_user\", \"secret_sauce\");",
                    "    await inventoryPage.expectLoaded();",
                    "});",
                    "",
                    "Test cases JSON:",
                    JSON.stringify(testCaseGenerationResult, null, 2),
                ].join("\n"),
            },
        ],
    });

    const rawText = response.output_text;

    if (!rawText) {
        throw new Error("AI response was empty.");
    }

    const parsedJson = parseJson(rawText);

    return GeneratedTestFileSchema.parse(parsedJson);
}

function parseJson(rawText: string): unknown {
    try {
        return JSON.parse(rawText);
    } catch {
        throw new Error(`Failed to parse AI response as JSON. Raw response: ${rawText}`);
    }
}

function assertGeneratedCodeLooksSafe(code: string): void {
    const forbiddenPatterns = [
        /\.waitForTimeout\(/,
        /force:\s*true/,
        /child_process/,
        /exec\(/,
        /spawn\(/,
        /process\.env\.OPENAI_API_KEY/,
        /test\.step\(/,
        /page\.locator\(/,
        /page\.getByRole\(/,
        /page\.getByText\(/,
        /page\.getByPlaceholder\(/,
    ];

    const matchedPattern = forbiddenPatterns.find((pattern) => pattern.test(code));

    if (matchedPattern) {
        throw new Error(`Generated test code failed safety validation: ${matchedPattern.source}`);
    }
}

function assertGeneratedCodeUsesOnlyKnownPomApi(code: string): void {
    const pomVariableNames = getPomVariableNames();
    const variablePattern = pomVariableNames.join("|");
    const methodCallPattern = new RegExp(`\\b(${variablePattern})\\.([a-zA-Z_$][\\w$]*)\\s*\\(([^;]*)\\)`, "g");

    for (const match of code.matchAll(methodCallPattern)) {
        const [, variableName, methodName, rawArguments] = match;

        if (!variableName || !methodName || rawArguments === undefined) {
            continue;
        }

        const methodContract = getPomMethodContract(variableName, methodName);

        if (!methodContract) {
            throw new Error(`Generated test uses unsupported POM API: ${variableName}.${methodName}()`);
        }

        const argumentCount = countTopLevelArguments(rawArguments);

        if (argumentCount < methodContract.minArgs || argumentCount > methodContract.maxArgs) {
            throw new Error(
                [
                    `Generated test uses invalid argument count for ${variableName}.${methodName}().`,
                    `Expected ${methodContract.minArgs}-${methodContract.maxArgs}, received ${argumentCount}.`,
                    `Signature: ${methodContract.signature}`,
                ].join(" "),
            );
        }
    }
}

function countTopLevelArguments(rawArguments: string): number {
    const trimmedArguments = rawArguments.trim();

    if (!trimmedArguments) {
        return 0;
    }

    let count = 1;
    let depth = 0;
    let quote: string | undefined;
    let previousCharacter = "";

    for (const character of trimmedArguments) {
        if (quote) {
            if (character === quote && previousCharacter !== "\\") {
                quote = undefined;
            }

            previousCharacter = character;
            continue;
        }

        if (character === "\"" || character === "'" || character === "`") {
            quote = character;
        } else if (character === "(" || character === "[" || character === "{") {
            depth += 1;
        } else if (character === ")" || character === "]" || character === "}") {
            depth -= 1;
        } else if (character === "," && depth === 0) {
            count += 1;
        }

        previousCharacter = character;
    }

    return count;
}
