import { z } from "zod";
import { createOpenAiClient } from "../ai/openAiClient";
import type { TestCaseGenerationResult } from "./testCaseGenerator";

const GeneratedTestFileSchema = z.object({
    filePath: z.literal("tests/generated/saucedemo-ai-generated.spec.ts"),
    code: z.string().min(1),
});

export type GeneratedTestFile = z.infer<typeof GeneratedTestFileSchema>;

const POM_API_CONTRACT = `
Available POM imports:
import { LoginPage } from "../../src/pages/LoginPage";
import { InventoryPage } from "../../src/pages/InventoryPage";
import { CartPage } from "../../src/pages/CartPage";
import { CheckoutPage } from "../../src/pages/CheckoutPage";

Available POM methods and exact signatures:

LoginPage:
- open(): Promise<void>
- login(username: string, password: string): Promise<void>
- expectErrorMessage(): Promise<void>

InventoryPage:
- expectOpened(): Promise<void>
- addProductToCart(productName: string): Promise<void>
- openCart(): Promise<void>

CartPage:
- expectProductInCart(productName: string): Promise<void>
- proceedToCheckout(): Promise<void>

CheckoutPage:
- fillInformation(firstName: string, lastName: string, postalCode: string): Promise<void>
- continueCheckout(): Promise<void>
- finishCheckout(): Promise<void>
- expectOrderCompleted(): Promise<void>
`;

export async function generatePlaywrightTestFile(
    testCaseGenerationResult: TestCaseGenerationResult
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
                    "Use only the existing Page Object Model API provided by the user.",
                    "Do not invent methods.",
                    "Do not change method names.",
                    "Do not pass arguments to methods that do not accept arguments.",
                    "Do not use hard waits, force clicks, brittle CSS/XPath selectors, or excessive retries.",
                    "Return only valid JSON.",
                    "Do not wrap the JSON in markdown.",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    "Generate one Playwright spec file for SauceDemo.",
                    "",
                    "The output must be JSON with exactly this structure:",
                    JSON.stringify(
                        {
                            filePath: "tests/generated/saucedemo-ai-generated.spec.ts",
                            code: "TypeScript Playwright spec file content here",
                        },
                        null,
                        2
                    ),
                    "",
                    POM_API_CONTRACT,
                    "",
                    "Rules:",
                    "- Use import { test } from '@playwright/test';",
                    "- Do not import expect.",
                    "- Do not use test.step in generated tests.",
                    "- Step reporting is handled inside POM methods by @step decorators.",
                    "- Add @smoke or @regression tags based on the test case type.",
                    "- Use standard_user / secret_sauce for successful login.",
                    "- Use locked_out_user / secret_sauce for locked out login validation.",
                    "- Keep tests independent.",
                    "- Do not generate tests for scenarios unsupported by the POM API.",
                    "- Do not assert raw UI locators directly in tests.",
                    "- Do not use page.locator inside generated tests.",
                    "- Do not add comments explaining the code.",
                    "",
                    "Important examples:",
                    "",
                    "Correct:",
                    "await inventoryPage.expectOpened();",
                    "await cartPage.expectProductInCart('Sauce Labs Backpack');",
                    "await cartPage.proceedToCheckout();",
                    "await checkoutPage.continueCheckout();",
                    "await loginPage.expectErrorMessage();",
                    "",
                    "Incorrect:",
                    "await inventoryPage.expectLoaded();",
                    "await cartPage.expectLoaded();",
                    "await cartPage.checkout();",
                    "await checkoutPage.continue();",
                    "await loginPage.expectErrorMessage('Some message');",
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
    const generatedTestFile = GeneratedTestFileSchema.parse(parsedJson);

    assertGeneratedCodeLooksSafe(generatedTestFile.code);
    assertGeneratedCodeUsesOnlyKnownPomApi(generatedTestFile.code);

    return generatedTestFile;
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
        /getByRole\(/,
        /getByText\(/,
        /getByPlaceholder\(/,
    ];

    const matchedPattern = forbiddenPatterns.find((pattern) => pattern.test(code));

    if (matchedPattern) {
        throw new Error(`Generated test code failed safety validation: ${matchedPattern.source}`);
    }
}

function assertGeneratedCodeUsesOnlyKnownPomApi(code: string): void {
    const forbiddenPomCalls = [
        /loginPage\.expectLoaded\(/,
        /loginPage\.expectElementsVisible\(/,
        /loginPage\.expectErrorMessage\([^)]/,

        /inventoryPage\.expectLoaded\(/,
        /inventoryPage\.logout\(/,
        /inventoryPage\.expectCartBadgeCount\(/,

        /cartPage\.expectLoaded\(/,
        /cartPage\.expectProductVisible\(/,
        /cartPage\.checkout\(/,
        /cartPage\.continueShopping\(/,

        /checkoutPage\.expectInformationStepLoaded\(/,
        /checkoutPage\.fillCustomerInformation\(/,
        /checkoutPage\.continue\(/,
        /checkoutPage\.expectOverviewStepLoaded\(/,
        /checkoutPage\.finish\(/,
        /checkoutPage\.expectErrorMessage\(/,
    ];

    const matchedPattern = forbiddenPomCalls.find((pattern) => pattern.test(code));

    if (matchedPattern) {
        throw new Error(`Generated test uses unsupported POM API: ${matchedPattern.source}`);
    }
}