import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class InventoryPage {
    private readonly page: Page;
    private readonly title: Locator;
    private readonly cartLink: Locator;
    private readonly cartBadge: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByText("Products");
        this.cartLink = page.locator("[data-test='shopping-cart-link']");
        this.cartBadge = page.locator("[data-test='shopping-cart-badge']");
    }

    private productAddButton(productName: string): Locator {
        return this.page
            .locator(".inventory_item")
            .filter({hasText: productName})
            .getByRole("button", {name: "Add to cart"});
    }

    @step("Verify inventory page is loaded")
    async expectLoaded(): Promise<void> {
        await expect(this.title).toBeVisible();
    }

    @step("Verify inventory page is opened")
    async expectOpened(): Promise<void> {
        await this.expectLoaded();
    }

    @step("Add product to cart: {0}")
    async addProductToCart(productName: string): Promise<void> {
        await this.productAddButton(productName).click();
    }

    @step("Verify cart badge count: {0}")
    async expectCartBadgeCount(count: number): Promise<void> {
        await expect(this.cartBadge).toHaveText(String(count));
    }

    @step("Open cart")
    async openCart(): Promise<void> {
        await this.cartLink.click();
    }
}
