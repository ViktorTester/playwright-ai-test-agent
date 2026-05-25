import {z} from "zod";
import type {SiteAnalysisResult} from "./siteAnalyzer";
import {createOpenAiClient} from "../ai/openAiClient";

const TestTypeSchema = z.enum(["smoke", "regression"]);
const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const TestCaseSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: TestTypeSchema,
    risk: RiskLevelSchema,
    objective: z.string(),
    preconditions: z.array(z.string()),
    steps: z.array(z.string()),
    expectedResult: z.string(),
    suggestedPomMethods: z.array(z.string()),
});

export const TestCaseGenerationResultSchema = z.object({
    applicationName: z.string(),
    summary: z.string(),
    testCases: z.array(TestCaseSchema).min(1),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestCaseGenerationResult = z.infer<typeof TestCaseGenerationResultSchema>;

export async function generateTestCases(
    siteAnalysis: SiteAnalysisResult,
): Promise<TestCaseGenerationResult> {
    const openai = createOpenAiClient();

    const model = process.env.AI_MODEL ?? "gpt-4.1-mini";

    const response = await openai.responses.create({
        model,
        input: [
            {
                role: "system",
                content: [
                    "You are a senior QA automation engineer.",
                    "Generate practical Playwright test cases from the provided site analysis.",
                    "Use risk-based testing.",
                    "Separate smoke and regression scenarios.",
                    "Prefer stable scenarios suitable for Page Object Model.",
                    "Do not invent unsupported functionality.",
                    "Return only valid JSON.",
                    "Do not wrap the JSON in markdown.",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    "Analyze this website model and propose test cases.",
                    "",
                    "Target application: SauceDemo.",
                    "Known credentials:",
                    "- standard_user / secret_sauce",
                    "- locked_out_user / secret_sauce",
                    "",
                    "Existing POM classes:",
                    "- LoginPage",
                    "- InventoryPage",
                    "- CartPage",
                    "- CheckoutPage",
                    "",
                    "Return JSON using exactly this structure:",
                    "",
                    JSON.stringify(
                        {
                            applicationName: "SauceDemo",
                            summary: "Short summary of generated coverage.",
                            testCases: [
                                {
                                    id: "TC-001",
                                    title: "Valid user can log in",
                                    type: "smoke",
                                    risk: "high",
                                    objective: "Verify that a valid user can access the inventory page.",
                                    preconditions: ["User is on the login page"],
                                    steps: [
                                        "Open login page",
                                        "Enter valid username",
                                        "Enter valid password",
                                        "Click Login",
                                    ],
                                    expectedResult: "Inventory page is displayed.",
                                    suggestedPomMethods: [
                                        "LoginPage.open",
                                        "LoginPage.login",
                                        "InventoryPage.expectLoaded",
                                    ],
                                },
                            ],
                        },
                        null,
                        2,
                    ),
                    "",
                    "Site analysis JSON:",
                    JSON.stringify(siteAnalysis, null, 2),
                ].join("\n"),
            },
        ],
    });

    const rawText = response.output_text;

    if (!rawText) {
        throw new Error("AI response was empty.");
    }

    const parsedJson = parseJson(rawText);

    return TestCaseGenerationResultSchema.parse(parsedJson);
}

function parseJson(rawText: string): unknown {
    try {
        return JSON.parse(rawText);
    } catch {
        throw new Error(`Failed to parse AI response as JSON. Raw response: ${rawText}`);
    }
}