import "dotenv/config";
import { analyzeSite } from "./siteAnalyzer";
import { generateTestCases } from "./testCaseGenerator";
import { ensureProjectDirectories, writeProjectFile } from "../utils/fileSystem";
import { runShellCommand } from "../utils/shell";

async function main(): Promise<void> {
    await ensureProjectDirectories();

    const baseUrl = process.env.BASE_URL ?? "https://www.saucedemo.com";

    console.log(`Analyzing site: ${baseUrl}`);

    const analysis = await analyzeSite(baseUrl);

    await writeProjectFile(
        "agent-output/analysis/saucedemo-analysis.json",
        JSON.stringify(analysis, null, 2),
    );

    console.log("Generating test cases with AI...");

    const testCaseGenerationResult = await generateTestCases(analysis);

    await writeProjectFile(
        "agent-output/test-cases/saucedemo-test-cases.json",
        JSON.stringify(testCaseGenerationResult, null, 2),
    );

    const playwrightVersion = await runShellCommand("npx", ["playwright", "--version"]);

    await writeProjectFile(
        "agent-output/reports/agent-report.md",
        [
            "# Agent Report",
            "",
            "## Site analysis",
            "",
            `Base URL: ${analysis.baseUrl}`,
            `Current URL: ${analysis.currentUrl}`,
            `Page title: ${analysis.pageTitle}`,
            "",
            "## Elements found",
            "",
            `Inputs: ${analysis.inputs.length}`,
            `Buttons: ${analysis.buttons.length}`,
            `Links: ${analysis.links.length}`,
            `Headings: ${analysis.headings.length}`,
            "",
            "## Generated test cases",
            "",
            `Application: ${testCaseGenerationResult.applicationName}`,
            `Summary: ${testCaseGenerationResult.summary}`,
            `Total: ${testCaseGenerationResult.testCases.length}`,
            `Smoke: ${testCaseGenerationResult.testCases.filter((testCase) => testCase.type === "smoke").length}`,
            `Regression: ${testCaseGenerationResult.testCases.filter((testCase) => testCase.type === "regression").length}`,
            "",
            "## Tooling",
            "",
            `Playwright: ${playwrightVersion.stdout}`,
            "",
        ].join("\n"),
    );

    console.log("Site analysis saved to agent-output/analysis/saucedemo-analysis.json");
    console.log("Test cases saved to agent-output/test-cases/saucedemo-test-cases.json");
    console.log("Report saved to agent-output/reports/agent-report.md");
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});