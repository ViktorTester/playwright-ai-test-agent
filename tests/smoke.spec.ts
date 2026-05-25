import {expect, test} from "@playwright/test";

test("@smoke SauceDemo login page is opened", async ({page}) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Swag Labs/);
    await expect(page.getByPlaceholder("Username")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", {name: "Login"})).toBeVisible();
});