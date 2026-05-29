import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class CheckoutPage {
    private readonly page: Page;
    private readonly firstNameInput: Locator;
    private readonly lastNameInput: Locator;
    private readonly postalCodeInput: Locator;
    private readonly continueButton: Locator;
    private readonly finishButton: Locator;
    private readonly completeHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.firstNameInput = page.getByPlaceholder("First Name");
        this.lastNameInput = page.getByPlaceholder("Last Name");
        this.postalCodeInput = page.getByPlaceholder("Zip/Postal Code");
        this.continueButton = page.getByRole("button", {name: "Continue"});
        this.finishButton = page.getByRole("button", {name: "Finish"});
        this.completeHeader = page.getByText("Thank you for your order!");
    }

    @step("Fill checkout information")
    async fillInformation(
        firstName: string,
        lastName: string,
        postalCode: string
    ): Promise<void> {
        await this.firstNameInput.fill(firstName);
        await this.lastNameInput.fill(lastName);
        await this.postalCodeInput.fill(postalCode);
    }

    @step("Continue checkout")
    async continueCheckout(): Promise<void> {
        await this.continueButton.click();
    }

    @step("Finish checkout")
    async finishCheckout(): Promise<void> {
        await this.finishButton.click();
    }

    @step("Verify order is completed")
    async expectOrderCompleted(): Promise<void> {
        await expect(this.completeHeader).toBeVisible();
    }
}