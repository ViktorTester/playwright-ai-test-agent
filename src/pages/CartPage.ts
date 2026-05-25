import {expect, type Locator, type Page} from "@playwright/test";

export class CartPage {
    readonly page: Page;
    readonly title: Locator;
    readonly checkoutButton: Locator;
    readonly continueShoppingButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.locator("[data-test='title']");
        this.checkoutButton = page.locator("[data-test='checkout']");
        this.continueShoppingButton = page.locator("[data-test='continue-shopping']");
    }

    async expectLoaded(): Promise<void> {
        await expect(this.page).toHaveURL(/cart/);
        await expect(this.title).toHaveText("Your Cart");
    }

    async expectProductVisible(productName: string): Promise<void> {
        await expect(this.page.getByText(productName)).toBeVisible();
    }

    async checkout(): Promise<void> {
        await this.checkoutButton.click();
    }

    async continueShopping(): Promise<void> {
        await this.continueShoppingButton.click();
    }
}