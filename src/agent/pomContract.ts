export type PomMethodContract = {
    readonly name: string;
    readonly signature: string;
    readonly minArgs: number;
    readonly maxArgs: number;
    readonly description: string;
};

export type PomClassContract = {
    readonly className: string;
    readonly variableName: string;
    readonly importPath: string;
    readonly methods: readonly PomMethodContract[];
};

export const POM_CLASSES = [
    {
        className: "LoginPage",
        variableName: "loginPage",
        importPath: "../../src/pages/LoginPage",
        methods: [
            {
                name: "open",
                signature: "open(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Open the SauceDemo login page.",
            },
            {
                name: "expectLoaded",
                signature: "expectLoaded(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Verify that the login page is loaded.",
            },
            {
                name: "login",
                signature: "login(username: string, password: string): Promise<void>",
                minArgs: 2,
                maxArgs: 2,
                description: "Log in with the provided username and password.",
            },
            {
                name: "expectErrorMessage",
                signature: "expectErrorMessage(expectedMessage?: string): Promise<void>",
                minArgs: 0,
                maxArgs: 1,
                description: "Verify that the login error message is visible. Optionally verify exact text.",
            },
        ],
    },
    {
        className: "InventoryPage",
        variableName: "inventoryPage",
        importPath: "../../src/pages/InventoryPage",
        methods: [
            {
                name: "expectLoaded",
                signature: "expectLoaded(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Verify that the inventory page is loaded.",
            },
            {
                name: "expectOpened",
                signature: "expectOpened(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Alias for expectLoaded().",
            },
            {
                name: "addProductToCart",
                signature: "addProductToCart(productName: string): Promise<void>",
                minArgs: 1,
                maxArgs: 1,
                description: "Add the requested inventory product to cart.",
            },
            {
                name: "expectCartBadgeCount",
                signature: "expectCartBadgeCount(count: number): Promise<void>",
                minArgs: 1,
                maxArgs: 1,
                description: "Verify shopping cart badge count.",
            },
            {
                name: "openCart",
                signature: "openCart(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Open the shopping cart page.",
            },
        ],
    },
    {
        className: "CartPage",
        variableName: "cartPage",
        importPath: "../../src/pages/CartPage",
        methods: [
            {
                name: "expectLoaded",
                signature: "expectLoaded(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Verify that the cart page is loaded.",
            },
            {
                name: "expectProductVisible",
                signature: "expectProductVisible(productName: string): Promise<void>",
                minArgs: 1,
                maxArgs: 1,
                description: "Verify that the requested product is visible in the cart.",
            },
            {
                name: "expectProductInCart",
                signature: "expectProductInCart(productName: string): Promise<void>",
                minArgs: 1,
                maxArgs: 1,
                description: "Alias for expectProductVisible(productName).",
            },
            {
                name: "checkout",
                signature: "checkout(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Proceed from cart to checkout.",
            },
            {
                name: "proceedToCheckout",
                signature: "proceedToCheckout(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Alias for checkout().",
            },
        ],
    },
    {
        className: "CheckoutPage",
        variableName: "checkoutPage",
        importPath: "../../src/pages/CheckoutPage",
        methods: [
            {
                name: "expectInformationStepLoaded",
                signature: "expectInformationStepLoaded(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Verify that the checkout information step is loaded.",
            },
            {
                name: "fillCustomerInformation",
                signature: "fillCustomerInformation(firstName: string, lastName: string, postalCode: string): Promise<void>",
                minArgs: 3,
                maxArgs: 3,
                description: "Fill checkout customer information.",
            },
            {
                name: "fillInformation",
                signature: "fillInformation(firstName: string, lastName: string, postalCode: string): Promise<void>",
                minArgs: 3,
                maxArgs: 3,
                description: "Alias for fillCustomerInformation(firstName, lastName, postalCode).",
            },
            {
                name: "continueCheckout",
                signature: "continueCheckout(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Continue from information step to overview step.",
            },
            {
                name: "continue",
                signature: "continue(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Alias for continueCheckout().",
            },
            {
                name: "expectOverviewStepLoaded",
                signature: "expectOverviewStepLoaded(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Verify that checkout overview step is loaded.",
            },
            {
                name: "finish",
                signature: "finish(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Finish checkout.",
            },
            {
                name: "finishCheckout",
                signature: "finishCheckout(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Alias for finish().",
            },
            {
                name: "expectOrderCompleted",
                signature: "expectOrderCompleted(): Promise<void>",
                minArgs: 0,
                maxArgs: 0,
                description: "Verify that the order completion page is displayed.",
            },
            {
                name: "expectErrorMessage",
                signature: "expectErrorMessage(expectedMessage?: string): Promise<void>",
                minArgs: 0,
                maxArgs: 1,
                description: "Verify checkout error message. Optionally verify exact text.",
            },
        ],
    },
] as const satisfies readonly PomClassContract[];

export function renderPomImports(): string {
    return POM_CLASSES.map(
        ({className, importPath}) => `import {${className}} from "${importPath}";`,
    ).join("\n");
}

export function renderPomApiContract(): string {
    const lines = ["Available POM imports:", renderPomImports(), "", "Available POM methods and exact signatures:"];

    for (const pomClass of POM_CLASSES) {
        lines.push("", `${pomClass.className}:`);

        for (const method of pomClass.methods) {
            lines.push(`- ${method.signature} - ${method.description}`);
        }
    }

    return lines.join("\n");
}

export function getPomMethodContract(
    variableName: string,
    methodName: string,
): PomMethodContract | undefined {
    const pomClass = POM_CLASSES.find((candidate) => candidate.variableName === variableName);

    return pomClass?.methods.find((method) => method.name === methodName);
}

export function getPomVariableNames(): string[] {
    return POM_CLASSES.map((pomClass) => pomClass.variableName);
}
