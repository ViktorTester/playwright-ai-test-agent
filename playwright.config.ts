import {defineConfig, devices} from "@playwright/test";
import "dotenv/config";

export default defineConfig({
    testDir: "./tests",

    timeout: 60_000,

    expect: {
        timeout: 10_000,
    },

    fullyParallel: true,

    retries: process.env.CI ? 1 : 0,

    workers: process.env.CI ? 2 : undefined,

    reporter: [
        ["list"],
        ["html", {open: "never"}],
    ],

    use: {
        baseURL: process.env.BASE_URL ?? "https://www.saucedemo.com",

        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",

        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },

    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
            },
        },
    ],
});