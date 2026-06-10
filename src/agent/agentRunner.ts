import "dotenv/config";
import {analyzeSite} from "./siteAnalyzer";
import {generateTestCases} from "./testCaseGenerator";
import {generatePlaywrightTestFile} from "./testFileGenerator";
import {ensureProjectDirectories, writeProjectFile} from "../utils/fileSystem";
import {runShellCommand} from "../utils/shell";

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

    console.log("Generating Playwright test file with AI...");

    const generatedTestFile = await generatePlaywrightTestFile(testCaseGenerationResult);

    await writeProjectFile(generatedTestFile.filePath, generatedTestFile.code);

    await writeProjectFile(
        "agent-output/generated-tests/saucedemo-ai-generated.spec.ts",
        generatedTestFile.code,
    );

    console.log("Running TypeScript validation...");

    const typeCheckResult = await runShellCommand("npx", ["tsc", "--noEmit"]);

    console.log("Running generated Playwright tests...");

    const generatedTestRunResult = await runShellCommand("npx", [
        "playwright",
        "test",
        generatedTestFile.filePath,
    ]);

    const playwrightVersion = await runShellCommand("npx", ["playwright", "--version"]);

    await writeProjectFile(
        "agent-output/reports/agent-report.md",
        [
            "# Agent Report",
            "",
            "## Site analysis",
            "",
            `Base URL: ${analysis.baseUrl}`,
            `Pages analyzed: ${analysis.pages.length}`,
            `Transitions discovered: ${analysis.transitions.length}`,
            "",
            "## Elements found",
            "",
            `Inputs: ${analysis.pages.reduce((total, analyzedPage) => total + analyzedPage.inputs.length, 0)}`,
            `Buttons: ${analysis.pages.reduce((total, analyzedPage) => total + analyzedPage.buttons.length, 0)}`,
            `Links: ${analysis.pages.reduce((total, analyzedPage) => total + analyzedPage.links.length, 0)}`,
            `Headings: ${analysis.pages.reduce((total, analyzedPage) => total + analyzedPage.headings.length, 0)}`,
            "",
            "## Generated test cases",
            "",
            `Application: ${testCaseGenerationResult.applicationName}`,
            `Summary: ${testCaseGenerationResult.summary}`,
            `Total: ${testCaseGenerationResult.testCases.length}`,
            `Smoke: ${testCaseGenerationResult.testCases.filter((testCase) => testCase.type === "smoke").length}`,
            `Regression: ${testCaseGenerationResult.testCases.filter((testCase) => testCase.type === "regression").length}`,
            "",
            "## Generated test file",
            "",
            `Path: ${generatedTestFile.filePath}`,
            "",
            "## Validation",
            "",
            `TypeScript command: ${typeCheckResult.command}`,
            `TypeScript exit code: ${typeCheckResult.exitCode}`,
            "",
            `Generated test command: ${generatedTestRunResult.command}`,
            `Generated test exit code: ${generatedTestRunResult.exitCode}`,
            "",
            "## Tooling",
            "",
            `Playwright: ${playwrightVersion.stdout}`,
            "",
        ].join("\n"),
    );

    console.log("Site analysis saved to agent-output/analysis/saucedemo-analysis.json");
    console.log("Test cases saved to agent-output/test-cases/saucedemo-test-cases.json");
    console.log(`Generated test saved to ${generatedTestFile.filePath}`);
    console.log("Report saved to agent-output/reports/agent-report.md");

    if (typeCheckResult.failed || generatedTestRunResult.failed) {
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});