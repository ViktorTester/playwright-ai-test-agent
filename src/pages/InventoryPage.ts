import {expect, type Locator, type Page} from "@playwright/test";
import {step} from "../utils/testStep";

export class InventoryPage {
    private readonly page: Page;
    private readonly title: Locator;
    private readonly cartLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByText("Products");
        this.cartLink = page.locator("[data-test='shopping-cart-link']");
    }

    private productAddButton(productName: string): Locator {
        return this.page
            .locator(".inventory_item")
            .filter({hasText: productName})
            .getByRole("button", {name: "Add to cart"});
    }

    @step("Verify inventory page is opened")
    async expectOpened(): Promise<void> {
        await expect(this.title).toBeVisible();
    }

    @step("Add product to cart: {0}")
    async addProductToCart(productName: string): Promise<void> {
        await this.productAddButton(productName).click();
    }

    @step("Open cart")
    async openCart(): Promise<void> {
        await this.cartLink.click();
    }
}