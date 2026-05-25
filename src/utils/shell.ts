import {execa} from "execa";

export type ShellCommandResult = {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    failed: boolean;
};

export async function runShellCommand(
    command: string,
    args: string[] = [],
): Promise<ShellCommandResult> {
    const fullCommand = [command, ...args].join(" ");

    try {
        const result = await execa(command, args, {
            cwd: process.cwd(),
            reject: false,
            all: false,
        });

        return {
            command: fullCommand,
            exitCode: result.exitCode ?? 0,
            stdout: result.stdout,
            stderr: result.stderr,
            failed: result.failed,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return {
            command: fullCommand,
            exitCode: 1,
            stdout: "",
            stderr: message,
            failed: true,
        };
    }
}