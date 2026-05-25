import {test} from "@playwright/test";
import {CartPage} from "../src/pages/CartPage";
import {CheckoutPage} from "../src/pages/CheckoutPage";
import {InventoryPage} from "../src/pages/InventoryPage";
import {LoginPage} from "../src/pages/LoginPage";

test("@smoke user can complete checkout with one product", async ({page}) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    await test.step("Open login page and sign in as standard user", async () => {
        await loginPage.open();
        await loginPage.expectLoaded();
        await loginPage.login("standard_user", "secret_sauce");
    });

    await test.step("Add product to cart", async () => {
        await inventoryPage.expectLoaded();
        await inventoryPage.addProductToCart("Sauce Labs Backpack");
        await inventoryPage.expectCartBadgeCount(1);
    });

    await test.step("Open cart and verify selected product", async () => {
        await inventoryPage.openCart();
        await cartPage.expectLoaded();
        await cartPage.expectProductVisible("Sauce Labs Backpack");
    });

    await test.step("Complete checkout", async () => {
        await cartPage.checkout();

        await checkoutPage.expectInformationStepLoaded();
        await checkoutPage.fillCustomerInformation("John", "Smith", "LV-1001");
        await checkoutPage.continue();

        await checkoutPage.expectOverviewStepLoaded();
        await checkoutPage.finish();

        await checkoutPage.expectOrderCompleted();
    });
});