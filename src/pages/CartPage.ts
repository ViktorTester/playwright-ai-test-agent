import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class CartPage {
    private readonly page: Page;
    private readonly title: Locator;
    private readonly checkoutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByText("Your Cart");
        this.checkoutButton = page.getByRole("button", {name: "Checkout"});
    }

    private cartItem(productName: string): Locator {
        return this.page.locator(".cart_item").filter({hasText: productName});
    }

    @step("Verify cart page is loaded")
    async expectLoaded(): Promise<void> {
        await expect(this.title).toBeVisible();
        await expect(this.checkoutButton).toBeVisible();
    }

    @step("Verify product is visible in cart: {0}")
    async expectProductVisible(productName: string): Promise<void> {
        await expect(this.cartItem(productName)).toBeVisible();
    }

    @step("Verify product is in cart: {0}")
    async expectProductInCart(productName: string): Promise<void> {
        await this.expectProductVisible(productName);
    }

    @step("Proceed to checkout")
    async checkout(): Promise<void> {
        await this.checkoutButton.click();
    }

    @step("Proceed to checkout")
    async proceedToCheckout(): Promise<void> {
        await this.checkout();
    }
}
