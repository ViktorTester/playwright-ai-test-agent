import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class CartPage {
    private readonly page: Page;
    private readonly checkoutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.checkoutButton = page.getByRole("button", {name: "Checkout"});
    }

    private cartItem(productName: string): Locator {
        return this.page.locator(".cart_item").filter({hasText: productName});
    }

    @step("Verify product is in cart: {0}")
    async expectProductInCart(productName: string): Promise<void> {
        await expect(this.cartItem(productName)).toBeVisible();
    }

    @step("Proceed to checkout")
    async proceedToCheckout(): Promise<void> {
        await this.checkoutButton.click();
    }
}