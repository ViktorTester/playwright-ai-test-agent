import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class LoginPage {
    private readonly page: Page;
    private readonly usernameInput: Locator;
    private readonly passwordInput: Locator;
    private readonly loginButton: Locator;
    private readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;
        this.usernameInput = page.getByPlaceholder("Username");
        this.passwordInput = page.getByPlaceholder("Password");
        this.loginButton = page.getByRole("button", {name: "Login"});
        this.errorMessage = page.locator("[data-test='error']");
    }

    @step("Open login page")
    async open(): Promise<void> {
        await this.page.goto("/");
    }

    @step("Login with username: {0}")
    async login(username: string, password: string): Promise<void> {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }

    @step("Verify login error message")
    async expectErrorMessage(): Promise<void> {
        await expect(this.errorMessage).toBeVisible();
    }

    @step("Verify login page is opened")
    async expectLoaded(): Promise<void> {
        await expect(this.usernameInput).toBeVisible();
        await expect(this.passwordInput).toBeVisible();
        await expect(this.loginButton).toBeVisible();
    }
}