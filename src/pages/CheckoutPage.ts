import {expect, type Locator, type Page} from "@playwright/test";

export class CheckoutPage {
    readonly page: Page;
    readonly title: Locator;
    readonly firstNameInput: Locator;
    readonly lastNameInput: Locator;
    readonly postalCodeInput: Locator;
    readonly continueButton: Locator;
    readonly finishButton: Locator;
    readonly completeHeader: Locator;
    readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.locator("[data-test='title']");
        this.firstNameInput = page.locator("[data-test='firstName']");
        this.lastNameInput = page.locator("[data-test='lastName']");
        this.postalCodeInput = page.locator("[data-test='postalCode']");
        this.continueButton = page.locator("[data-test='continue']");
        this.finishButton = page.locator("[data-test='finish']");
        this.completeHeader = page.locator("[data-test='complete-header']");
        this.errorMessage = page.locator("[data-test='error']");
    }

    async expectInformationStepLoaded(): Promise<void> {
        await expect(this.page).toHaveURL(/checkout-step-one/);
        await expect(this.title).toHaveText("Checkout: Your Information");
    }

    async fillCustomerInformation(firstName: string, lastName: string, postalCode: string): Promise<void> {
        await this.firstNameInput.fill(firstName);
        await this.lastNameInput.fill(lastName);
        await this.postalCodeInput.fill(postalCode);
    }

    async continue(): Promise<void> {
        await this.continueButton.click();
    }

    async expectOverviewStepLoaded(): Promise<void> {
        await expect(this.page).toHaveURL(/checkout-step-two/);
        await expect(this.title).toHaveText("Checkout: Overview");
    }

    async finish(): Promise<void> {
        await this.finishButton.click();
    }

    async expectOrderCompleted(): Promise<void> {
        await expect(this.page).toHaveURL(/checkout-complete/);
        await expect(this.completeHeader).toHaveText("Thank you for your order!");
    }

    async expectErrorMessage(message: string | RegExp): Promise<void> {
        await expect(this.errorMessage).toContainText(message);
    }
}