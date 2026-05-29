import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class CheckoutPage {
    private readonly page: Page;
    private readonly firstNameInput: Locator;
    private readonly lastNameInput: Locator;
    private readonly postalCodeInput: Locator;
    private readonly continueButton: Locator;
    private readonly finishButton: Locator;
    private readonly informationTitle: Locator;
    private readonly overviewTitle: Locator;
    private readonly completeHeader: Locator;
    private readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;
        this.firstNameInput = page.getByPlaceholder("First Name");
        this.lastNameInput = page.getByPlaceholder("Last Name");
        this.postalCodeInput = page.getByPlaceholder("Zip/Postal Code");
        this.continueButton = page.getByRole("button", {name: "Continue"});
        this.finishButton = page.getByRole("button", {name: "Finish"});
        this.informationTitle = page.getByText("Checkout: Your Information");
        this.overviewTitle = page.getByText("Checkout: Overview");
        this.completeHeader = page.getByText("Thank you for your order!");
        this.errorMessage = page.locator("[data-test='error']");
    }

    @step("Verify checkout information step is loaded")
    async expectInformationStepLoaded(): Promise<void> {
        await expect(this.informationTitle).toBeVisible();
        await expect(this.firstNameInput).toBeVisible();
        await expect(this.lastNameInput).toBeVisible();
        await expect(this.postalCodeInput).toBeVisible();
    }

    @step("Fill checkout information")
    async fillCustomerInformation(
        firstName: string,
        lastName: string,
        postalCode: string,
    ): Promise<void> {
        await this.firstNameInput.fill(firstName);
        await this.lastNameInput.fill(lastName);
        await this.postalCodeInput.fill(postalCode);
    }

    @step("Fill checkout information")
    async fillInformation(
        firstName: string,
        lastName: string,
        postalCode: string,
    ): Promise<void> {
        await this.fillCustomerInformation(firstName, lastName, postalCode);
    }

    @step("Continue checkout")
    async continueCheckout(): Promise<void> {
        await this.continueButton.click();
    }

    @step("Continue checkout")
    async continue(): Promise<void> {
        await this.continueCheckout();
    }

    @step("Verify checkout overview step is loaded")
    async expectOverviewStepLoaded(): Promise<void> {
        await expect(this.overviewTitle).toBeVisible();
        await expect(this.finishButton).toBeVisible();
    }

    @step("Finish checkout")
    async finish(): Promise<void> {
        await this.finishButton.click();
    }

    @step("Finish checkout")
    async finishCheckout(): Promise<void> {
        await this.finish();
    }

    @step("Verify order is completed")
    async expectOrderCompleted(): Promise<void> {
        await expect(this.completeHeader).toBeVisible();
    }

    @step("Verify checkout error message")
    async expectErrorMessage(expectedMessage?: string): Promise<void> {
        await expect(this.errorMessage).toBeVisible();

        if (expectedMessage) {
            await expect(this.errorMessage).toHaveText(expectedMessage);
        }
    }
}
