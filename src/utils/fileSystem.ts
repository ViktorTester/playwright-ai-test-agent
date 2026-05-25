import path from "node:path";
import fs from "fs-extra";

const ALLOWED_WRITE_DIRECTORIES = [
    "agent-output",
    "tests/generated",
    "src/pages",
] as const;

export async function ensureProjectDirectories(): Promise<void> {
    await Promise.all([
        fs.ensureDir("agent-output/analysis"),
        fs.ensureDir("agent-output/test-cases"),
        fs.ensureDir("agent-output/generated-tests"),
        fs.ensureDir("agent-output/repair"),
        fs.ensureDir("agent-output/reports"),
        fs.ensureDir("tests/generated"),
        fs.ensureDir("src/pages"),
    ]);
}

export async function writeProjectFile(relativePath: string, content: string): Promise<void> {
    assertSafeWritePath(relativePath);

    const absolutePath = path.resolve(process.cwd(), relativePath);

    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, "utf-8");
}

export async function readProjectFile(relativePath: string): Promise<string> {
    const absolutePath = path.resolve(process.cwd(), relativePath);

    if (!(await fs.pathExists(absolutePath))) {
        throw new Error(`File does not exist: ${relativePath}`);
    }

    return fs.readFile(absolutePath, "utf-8");
}

export async function pathExists(relativePath: string): Promise<boolean> {
    const absolutePath = path.resolve(process.cwd(), relativePath);

    return fs.pathExists(absolutePath);
}

function assertSafeWritePath(relativePath: string): void {
    const normalizedPath = path.normalize(relativePath);

    const isUnsafePath =
        path.isAbsolute(normalizedPath) ||
        normalizedPath.startsWith("..") ||
        normalizedPath.includes(`..${path.sep}`);

    if (isUnsafePath) {
        throw new Error(`Unsafe write path is not allowed: ${relativePath}`);
    }

    const isAllowedDirectory = ALLOWED_WRITE_DIRECTORIES.some((directory) =>
        normalizedPath === directory || normalizedPath.startsWith(`${directory}${path.sep}`),
    );

    if (!isAllowedDirectory) {
        throw new Error(
            `Write path is not allowed: ${relativePath}. Allowed directories: ${ALLOWED_WRITE_DIRECTORIES.join(", ")}`,
        );
    }
}