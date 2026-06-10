import {chromium, type Browser, type Locator, type Page, type BrowserContext} from "@playwright/test";

export type PageElementInfo = {
    readonly tagName: string;
    readonly text?: string;
    readonly role?: string;
    readonly placeholder?: string;
    readonly testId?: string;
    readonly name?: string;
    readonly type?: string;
    readonly href?: string;
    readonly isVisible: boolean;
    readonly recommendedLocator?: string;
};

export type PageFormInfo = {
    readonly inputs: PageElementInfo[];
    readonly buttons: PageElementInfo[];
};

export type PageAnalysisResult = {
    readonly pageName: string;
    readonly url: string;
    readonly title: string;
    readonly headings: string[];
    readonly inputs: PageElementInfo[];
    readonly buttons: PageElementInfo[];
    readonly links: PageElementInfo[];
    readonly forms: PageFormInfo[];
    readonly visibleTexts: string[];
};

export type SiteAnalysisResult = {
    readonly baseUrl: string;
    readonly analyzedAt: string;
    readonly pages: PageAnalysisResult[];
    readonly flowGraph: SiteFlowGraph;
};

export type SiteAnalyzerOptions = {
    readonly auth?: {
        readonly username: string;
        readonly password: string;
    };
    readonly maxPages?: number;
};

export type SiteFlowAction = {
    readonly fromPage: string;
    readonly toPage: string;
    readonly actionName: string;
    readonly pomMethod: string;
    readonly description: string;
};

export type SiteFlowGraph = {
    readonly actions: SiteFlowAction[];
};

type ClickCandidate = {
    readonly sourcePageUrl: string;
    readonly sourcePageName: string;
    readonly locator: string;
    readonly description: string;
};

type RawPageElementInfo = Omit<PageElementInfo, "recommendedLocator">;

export async function analyzeSite(
    baseUrl: string,
    options: SiteAnalyzerOptions = {},
): Promise<SiteAnalysisResult> {
    const browser = await chromium.launch({
        headless: true,
    });

    try {
        const context = await browser.newContext();

        context.setDefaultTimeout(5_000);
        context.setDefaultNavigationTimeout(10_000);

        const page = await context.newPage();
        const pages: PageAnalysisResult[] = [];
        const visitedUrls = new Set<string>();
        const urlsToVisit: string[] = [];
        const maxPages = options.maxPages ?? 10;

        console.log(`[site-analyzer] Max pages: ${maxPages}`);

        await page.goto(baseUrl, {
            waitUntil: "domcontentloaded",
        });

        await waitForPageReady(page);

        const loginPageAnalysis = await analyzeCurrentPage(page);
        pages.push(loginPageAnalysis);
        visitedUrls.add(normalizeUrl(page.url()));

        console.log(`[site-analyzer] Analyzed page: ${loginPageAnalysis.pageName} - ${loginPageAnalysis.url}`);

        if (options.auth) {
            await login(page, options.auth.username, options.auth.password);

            const authenticatedPageAnalysis = await analyzeCurrentPage(page);
            pages.push(authenticatedPageAnalysis);
            visitedUrls.add(normalizeUrl(page.url()));
        }

        urlsToVisit.push(...collectInternalUrlsFromPages(pages, baseUrl));

        while (urlsToVisit.length > 0 && pages.length < maxPages) {
            const nextUrl = urlsToVisit.shift();

            if (!nextUrl) {
                continue;
            }

            const normalizedUrl = normalizeUrl(nextUrl);

            if (visitedUrls.has(normalizedUrl)) {
                continue;
            }

            visitedUrls.add(normalizedUrl);

            await page.goto(nextUrl, {
                waitUntil: "domcontentloaded",
            });

            await waitForPageReady(page);

            const analyzedPage = await analyzeCurrentPage(page);
            pages.push(analyzedPage);

            urlsToVisit.push(...collectInternalUrlsFromPages([analyzedPage], baseUrl));
        }

        console.log("[site-analyzer] Starting safe click discovery...");

        const discoveredByClicks = await discoverPagesBySafeClicks(
            browser,
            context,
            pages,
            baseUrl,
            options.auth,
            visitedUrls,
            maxPages,
        );

        console.log(`[site-analyzer] Click discovery completed. New pages: ${discoveredByClicks.length}`);

        pages.push(...discoveredByClicks);

        return {
            baseUrl,
            analyzedAt: new Date().toISOString(),
            pages,
            flowGraph: buildFlowGraph(),
        };
    } finally {
        await closeBrowser(browser);
    }
}

async function analyzeCurrentPage(page: Page): Promise<PageAnalysisResult> {
    const [title, headings, inputs, buttons, links, forms, visibleTexts] = await Promise.all([
        page.title(),
        collectHeadings(page),
        collectInputs(page),
        collectButtons(page),
        collectLinks(page),
        collectForms(page),
        collectVisibleTexts(page),
    ]);

    return {
        pageName: inferPageName(page.url(), title, headings),
        url: page.url(),
        title,
        headings,
        inputs,
        buttons,
        links,
        forms,
        visibleTexts,
    };
}

async function login(page: Page, username: string, password: string): Promise<void> {
    await page.getByPlaceholder("Username").fill(username);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", {name: "Login"}).click();

    await page.waitForURL(/inventory\.html/, {
        timeout: 10_000,
    });

    await page.waitForLoadState("domcontentloaded", {
        timeout: 5_000,
    });
}

async function collectHeadings(page: Page): Promise<string[]> {
    return page
        .locator("h1, h2, h3")
        .evaluateAll((elements) =>
            elements
                .map((element) => element.textContent?.trim() ?? "")
                .filter(Boolean),
        );
}

async function collectInputs(page: Page): Promise<PageElementInfo[]> {
    return collectElementInfo(page.locator("input, textarea, select"));
}

async function collectButtons(page: Page): Promise<PageElementInfo[]> {
    return collectElementInfo(page.locator("button, input[type='submit'], input[type='button']"));
}

async function collectLinks(page: Page): Promise<PageElementInfo[]> {
    return collectElementInfo(page.locator("a"));
}

async function collectVisibleTexts(page: Page): Promise<string[]> {
    const texts = await page.locator("body").evaluate((body) => {
        const rawText = body.textContent ?? "";

        return rawText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    });

    return [...new Set(texts)].slice(0, 100);
}

async function collectForms(page: Page): Promise<PageFormInfo[]> {
    const formsCount = await page.locator("form").count();
    const forms: PageFormInfo[] = [];

    for (let index = 0; index < formsCount; index++) {
        const form = page.locator("form").nth(index);

        forms.push({
            inputs: await collectElementInfo(form.locator("input, textarea, select")),
            buttons: await collectElementInfo(
                form.locator("button, input[type='submit'], input[type='button']"),
            ),
        });
    }

    return forms;
}

async function collectElementInfo(locator: Locator): Promise<PageElementInfo[]> {
    const elements = await locator.evaluateAll((elementHandles) =>
        elementHandles.map((element) => {
            const htmlElement = element as HTMLElement;
            const inputElement = element as HTMLInputElement;
            const anchorElement = element as HTMLAnchorElement;

            const style = window.getComputedStyle(htmlElement);
            const rect = htmlElement.getBoundingClientRect();

            const isVisible =
                style.visibility !== "hidden" &&
                style.display !== "none" &&
                rect.width > 0 &&
                rect.height > 0;

            return {
                tagName: htmlElement.tagName.toLowerCase(),
                text:
                    htmlElement.innerText?.trim() ||
                    inputElement.value ||
                    htmlElement.getAttribute("aria-label") ||
                    htmlElement.getAttribute("placeholder") ||
                    undefined,
                role: htmlElement.getAttribute("role") ?? undefined,
                placeholder: htmlElement.getAttribute("placeholder") ?? undefined,
                testId: htmlElement.getAttribute("data-test") ?? undefined,
                name: htmlElement.getAttribute("name") ?? undefined,
                type: htmlElement.getAttribute("type") ?? undefined,
                href: anchorElement.href || undefined,
                isVisible,
            };
        }),
    );

    return elements.map(addRecommendedLocator);
}

function addRecommendedLocator(element: RawPageElementInfo): PageElementInfo {
    return {
        ...element,
        recommendedLocator: buildRecommendedLocator({
            tagName: element.tagName,
            text: element.text,
            placeholder: element.placeholder,
            testId: element.testId,
            name: element.name,
        }),
    };
}

function buildRecommendedLocator(element: {
    readonly tagName: string;
    readonly text?: string;
    readonly placeholder?: string;
    readonly testId?: string;
    readonly name?: string;
}): string | undefined {
    if (element.testId) {
        return `page.getByTestId("${element.testId}")`;
    }

    if (element.placeholder) {
        return `page.getByPlaceholder("${element.placeholder}")`;
    }

    if (element.tagName === "button" && element.text) {
        return `page.getByRole("button", {name: "${element.text}"})`;
    }

    if (element.tagName === "a" && element.text) {
        return `page.getByRole("link", {name: "${element.text}"})`;
    }

    if (element.name) {
        return `page.locator("[name='${element.name}']")`;
    }

    return undefined;
}

function inferPageName(url: string, title: string, headings: string[]): string {
    const normalizedUrl = url.toLowerCase();
    const normalizedTitle = title.toLowerCase();
    const headingText = headings.join(" ").toLowerCase();

    if (normalizedUrl.includes("inventory")) {
        return "Inventory page";
    }

    if (normalizedUrl.includes("cart")) {
        return "Cart page";
    }

    if (normalizedUrl.includes("checkout")) {
        return "Checkout page";
    }

    if (headingText.includes("products")) {
        return "Inventory page";
    }

    if (headingText.includes("cart")) {
        return "Cart page";
    }

    if (headingText.includes("checkout")) {
        return "Checkout page";
    }

    if (normalizedUrl === "https://www.saucedemo.com/" || normalizedUrl.endsWith("saucedemo.com")) {
        return "Login page";
    }

    if (normalizedTitle.includes("swag labs")) {
        return "Unknown SauceDemo page";
    }

    return "Unknown page";
}

async function discoverPagesBySafeClicks(
    browser: Browser,
    authenticatedContext: BrowserContext,
    analyzedPages: PageAnalysisResult[],
    baseUrl: string,
    auth: SiteAnalyzerOptions["auth"],
    visitedUrls: Set<string>,
    maxPages: number,
): Promise<PageAnalysisResult[]> {
    const discoveredPages: PageAnalysisResult[] = [];
    const storageState = await authenticatedContext.storageState();

    for (const analyzedPage of analyzedPages) {
        if (visitedUrls.size + discoveredPages.length >= maxPages) {
            break;
        }

        const candidates = collectSafeClickCandidates(analyzedPage);

        for (const candidate of candidates) {
            if (visitedUrls.size + discoveredPages.length >= maxPages) {
                break;
            }

            const clickContext = await browser.newContext({
                storageState,
            });

            clickContext.setDefaultTimeout(5_000);
            clickContext.setDefaultNavigationTimeout(10_000);

            const clickPage = await clickContext.newPage();

            try {
                await clickPage.goto(candidate.sourcePageUrl, {
                    waitUntil: "domcontentloaded",
                });

                await waitForPageReady(clickPage);

                if (auth && isLoginPage(clickPage.url())) {
                    await login(clickPage, auth.username, auth.password);

                    await clickPage.goto(candidate.sourcePageUrl, {
                        waitUntil: "domcontentloaded",
                    });

                    await waitForPageReady(clickPage);
                }

                await clickByRecommendedLocator(clickPage, candidate.locator);

                await clickPage.waitForLoadState("domcontentloaded");

                const currentUrl = normalizeUrl(clickPage.url());

                if (visitedUrls.has(currentUrl)) {
                    continue;
                }

                if (!isInternalSafeUrl(currentUrl, baseUrl)) {
                    continue;
                }

                visitedUrls.add(currentUrl);

                const analyzedDiscoveredPage = await analyzeCurrentPage(clickPage);
                discoveredPages.push(analyzedDiscoveredPage);
            } catch {
                // Ignore unstable or non-navigation click candidates.
            } finally {
                await clickContext.close();
            }
        }
    }

    return discoveredPages;
}

function collectSafeClickCandidates(page: PageAnalysisResult): ClickCandidate[] {
    const candidates: ClickCandidate[] = [];
    const elements = [...page.links, ...page.buttons];

    for (const element of elements) {
        if (!element.isVisible || !element.recommendedLocator) {
            continue;
        }

        const candidateText = [
            element.text,
            element.testId,
            element.name,
            element.type,
            element.recommendedLocator,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        if (!isSafeNavigationCandidate(candidateText)) {
            continue;
        }

        candidates.push({
            sourcePageUrl: page.url,
            sourcePageName: page.pageName,
            locator: element.recommendedLocator,
            description: candidateText,
        });
    }

    return candidates;
}

function isSafeNavigationCandidate(candidateText: string): boolean {
    const blockedKeywords = [
        "logout",
        "reset",
        "delete",
        "remove",
        "cancel",
        "finish",
        "complete",
        "facebook",
        "twitter",
        "linkedin",
    ];

    if (blockedKeywords.some((keyword) => candidateText.includes(keyword))) {
        return false;
    }

    const allowedKeywords = [
        "cart",
        "checkout",
        "continue",
        "back",
        "all items",
        "item",
        "details",
        "overview",
    ];

    return allowedKeywords.some((keyword) => candidateText.includes(keyword));
}

async function clickByRecommendedLocator(page: Page, recommendedLocator: string): Promise<void> {
    if (recommendedLocator.startsWith("page.getByTestId(")) {
        const testId = extractLocatorArgument(recommendedLocator);

        await page.getByTestId(testId).click({
            timeout: 3_000,
        });

        return;
    }

    if (recommendedLocator.startsWith("page.getByRole(\"link\"")) {
        const name = extractRoleName(recommendedLocator);

        await page.getByRole("link", {name}).click({
            timeout: 3_000,
        });

        return;
    }

    if (recommendedLocator.startsWith("page.getByRole(\"button\"")) {
        const name = extractRoleName(recommendedLocator);

        await page.getByRole("button", {name}).click({
            timeout: 3_000,
        });

        return;
    }

    throw new Error(`Unsupported click locator: ${recommendedLocator}`);
}

function extractLocatorArgument(recommendedLocator: string): string {
    const match = recommendedLocator.match(/\("([^"]+)"\)/);

    if (!match?.[1]) {
        throw new Error(`Cannot extract locator argument from: ${recommendedLocator}`);
    }

    return match[1];
}

function extractRoleName(recommendedLocator: string): string {
    const match = recommendedLocator.match(/name:\s*"([^"]+)"/);

    if (!match?.[1]) {
        throw new Error(`Cannot extract role name from: ${recommendedLocator}`);
    }

    return match[1];
}

function isLoginPage(url: string): boolean {
    const normalizedUrl = url.toLowerCase();

    return normalizedUrl === "https://www.saucedemo.com/" || normalizedUrl.endsWith("saucedemo.com/");
}

function collectInternalUrlsFromPages(
    pages: PageAnalysisResult[],
    baseUrl: string,
): string[] {
    const urls = new Set<string>();

    for (const page of pages) {
        for (const link of page.links) {
            if (!link.href) {
                continue;
            }

            if (!isInternalSafeUrl(link.href, baseUrl)) {
                continue;
            }

            urls.add(normalizeUrl(link.href));
        }
    }

    return [...urls];
}

function isInternalSafeUrl(url: string, baseUrl: string): boolean {
    try {
        const candidate = new URL(url);
        const base = new URL(baseUrl);

        if (candidate.origin !== base.origin) {
            return false;
        }

        const blockedPatterns = [
            "logout",
            "reset",
            "delete",
            "remove",
            "facebook",
            "twitter",
            "linkedin",
        ];

        return !blockedPatterns.some((pattern) =>
            candidate.href.toLowerCase().includes(pattern),
        );
    } catch {
        return false;
    }
}

function normalizeUrl(url: string): string {
    const parsedUrl = new URL(url);

    parsedUrl.hash = "";

    return parsedUrl.toString();
}

function buildFlowGraph(): SiteFlowGraph {
    return {
        actions: [
            {
                fromPage: "Login page",
                toPage: "Inventory page",
                actionName: "login as standard user",
                pomMethod: "loginPage.login(username, password)",
                description: "Logs in with valid credentials and opens inventory page.",
            },
            {
                fromPage: "Inventory page",
                toPage: "Cart page",
                actionName: "open cart",
                pomMethod: "inventoryPage.openCart()",
                description: "Opens the shopping cart from the inventory page.",
            },
            {
                fromPage: "Cart page",
                toPage: "Checkout step one page",
                actionName: "start checkout",
                pomMethod: "cartPage.checkout()",
                description: "Starts checkout from the cart page.",
            },
            {
                fromPage: "Checkout step one page",
                toPage: "Checkout step two page",
                actionName: "continue checkout",
                pomMethod: "checkoutPage.fillCustomerInformation(firstName, lastName, postalCode)",
                description: "Submits customer information and opens checkout overview.",
            },
            {
                fromPage: "Checkout step two page",
                toPage: "Checkout complete page",
                actionName: "finish checkout",
                pomMethod: "checkoutPage.finish()",
                description: "Finishes checkout and opens confirmation page.",
            },
        ],
    };
}

async function waitForPageReady(page: Page): Promise<void> {
    await page.waitForLoadState("domcontentloaded", {
        timeout: 5_000,
    }).catch(() => {
        // Analyzer should not fail only because the page did not reach a perfect load state.
    });
}

async function closeBrowser(browser: Browser): Promise<void> {
    await browser.close();
}