import "dotenv/config";
import {ensureProjectDirectories, writeProjectFile} from "../utils/fileSystem";
import {runShellCommand} from "../utils/shell";

async function main(): Promise<void> {
    await ensureProjectDirectories();

    await writeProjectFile(
        "agent-output/reports/agent-report.md",
        "# Agent Report\n\nAgent infrastructure is ready.\n",
    );

    const result = await runShellCommand("npx", ["playwright", "--version"]);

    console.log("Command:", result.command);
    console.log("Exit code:", result.exitCode);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});