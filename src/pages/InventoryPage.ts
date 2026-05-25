import {expect, type Locator, type Page} from "@playwright/test";

export class InventoryPage {
    readonly page: Page;
    readonly title: Locator;
    readonly cartLink: Locator;
    readonly menuButton: Locator;
    readonly logoutLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.locator("[data-test='title']");
        this.cartLink = page.locator("[data-test='shopping-cart-link']");
        this.menuButton = page.getByRole("button", {name: "Open Menu"});
        this.logoutLink = page.locator("[data-test='logout-sidebar-link']");
    }

    async expectLoaded(): Promise<void> {
        await expect(this.page).toHaveURL(/inventory/);
        await expect(this.title).toHaveText("Products");
    }

    productAddButton(productName: string): Locator {
        const testId = this.toProductAddButtonTestId(productName);
        return this.page.locator(`[data-test="${testId}"]`);
    }

    async addProductToCart(productName: string): Promise<void> {
        await this.productAddButton(productName).click();
    }

    async openCart(): Promise<void> {
        await this.cartLink.click();
    }

    async logout(): Promise<void> {
        await this.menuButton.click();
        await this.logoutLink.click();
    }

    async expectCartBadgeCount(count: number): Promise<void> {
        await expect(this.page.locator("[data-test='shopping-cart-badge']")).toHaveText(String(count));
    }

    private toProductAddButtonTestId(productName: string): string {
        return `add-to-cart-${productName.toLowerCase().replaceAll(" ", "-")}`;
    }
}