import {chromium, type Browser, type Page} from "@playwright/test";

export type PageElementInfo = {
    role?: string;
    text?: string;
    placeholder?: string;
    testId?: string;
    href?: string;
    tagName: string;
    isVisible: boolean;
};

export type AnalyzedPage = {
    url: string;
    title: string;
    headings: string[];
    inputs: PageElementInfo[];
    buttons: PageElementInfo[];
    links: PageElementInfo[];
    visibleTexts: string[];
};

export type SiteAnalysisResult = {
    baseUrl: string;
    pages: AnalyzedPage[];
    transitions: SiteTransition[];
};

export type SiteTransition = {
    fromUrl: string;
    toUrl: string;
    actionText?: string;
    actionTestId?: string;
};

const DEFAULT_MAX_PAGES = 10;

export async function analyzeSite(baseUrl: string): Promise<SiteAnalysisResult> {
    const browser = await chromium.launch({headless: true});
    const maxPages = Number(process.env.MAX_ANALYZED_PAGES ?? DEFAULT_MAX_PAGES);

    try {
        const page = await browser.newPage();
        await openAndAuthenticate(page, baseUrl);

        const pages = new Map<string, AnalyzedPage>();
        const transitions: SiteTransition[] = [];
        const queue: string[] = [normalizeUrl(page.url())];

        while (queue.length > 0 && pages.size < maxPages) {
            const currentUrl = queue.shift();

            if (!currentUrl || pages.has(currentUrl)) {
                continue;
            }

            await page.goto(currentUrl, {waitUntil: "domcontentloaded"});
            await page.waitForLoadState("networkidle").catch(() => undefined);

            const analyzedPage = await analyzeCurrentPage(page);
            pages.set(currentUrl, analyzedPage);

            const safeLinks = analyzedPage.links
                .filter((link) => link.href)
                .map((link) => normalizeUrl(link.href as string))
                .filter((href) => isSameOrigin(baseUrl, href))
                .filter((href) => !pages.has(href))
                .filter((href) => !queue.includes(href));

            queue.push(...safeLinks);

            const clickTransitions = await discoverSafeClickTransitions(browser, baseUrl, currentUrl);
            transitions.push(...clickTransitions);

            for (const transition of clickTransitions) {
                const targetUrl = normalizeUrl(transition.toUrl);

                if (!pages.has(targetUrl) && !queue.includes(targetUrl) && pages.size + queue.length < maxPages) {
                    queue.push(targetUrl);
                }
            }
        }

        return {
            baseUrl,
            pages: [...pages.values()],
            transitions,
        };
    } finally {
        await browser.close();
    }
}

async function openAndAuthenticate(page: Page, baseUrl: string): Promise<void> {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const username = process.env.SITE_USERNAME ?? "standard_user";
    const password = process.env.SITE_PASSWORD ?? "secret_sauce";

    const usernameInput = page.getByPlaceholder("Username");
    const passwordInput = page.getByPlaceholder("Password");
    const loginButton = page.getByRole("button", {name: "Login"});

    if (await usernameInput.isVisible().catch(() => false)) {
        await usernameInput.fill(username);
        await passwordInput.fill(password);
        await loginButton.click();
        await page.waitForLoadState("networkidle").catch(() => undefined);
    }
}

async function analyzeCurrentPage(page: Page): Promise<AnalyzedPage> {
    return {
        url: normalizeUrl(page.url()),
        title: await page.title(),
        headings: await collectHeadings(page),
        inputs: await collectInputs(page),
        buttons: await collectButtons(page),
        links: await collectLinks(page),
        visibleTexts: await collectVisibleTexts(page),
    };
}

async function discoverSafeClickTransitions(
    browser: Browser,
    baseUrl: string,
    sourceUrl: string,
): Promise<SiteTransition[]> {
    const page = await browser.newPage();
    const transitions: SiteTransition[] = [];

    try {
        await openAndAuthenticate(page, baseUrl);
        await page.goto(sourceUrl, {waitUntil: "domcontentloaded"});
        await page.waitForLoadState("networkidle").catch(() => undefined);

        const clickableElements = await collectSafeClickableElements(page);

        for (const clickableElement of clickableElements) {
            await page.goto(sourceUrl, {waitUntil: "domcontentloaded"});
            await page.waitForLoadState("networkidle").catch(() => undefined);

            const locator = clickableElement.testId
                ? page.locator(`[data-test="${clickableElement.testId}"]`)
                : page.getByText(clickableElement.text ?? "", {exact: true});

            const beforeUrl = normalizeUrl(page.url());

            await locator.first().click({timeout: 3_000}).catch(() => undefined);
            await page.waitForLoadState("networkidle").catch(() => undefined);

            const afterUrl = normalizeUrl(page.url());

            if (beforeUrl !== afterUrl && isSameOrigin(baseUrl, afterUrl)) {
                transitions.push({
                    fromUrl: beforeUrl,
                    toUrl: afterUrl,
                    actionText: clickableElement.text,
                    actionTestId: clickableElement.testId,
                });
            }
        }
    } finally {
        await page.close();
    }

    return transitions;
}

async function collectSafeClickableElements(page: Page): Promise<PageElementInfo[]> {
    const buttons = await collectButtons(page);
    const links = await collectLinks(page);

    return [...buttons, ...links]
        .filter((element) => element.isVisible)
        .filter((element) => !isDangerousAction(element))
        .slice(0, 20);
}

function isDangerousAction(element: PageElementInfo): boolean {
    const value = `${element.text ?? ""} ${element.testId ?? ""}`.toLowerCase();

    return [
        "logout",
        "reset",
        "remove",
        "delete",
        "cancel",
        "finish",
        "checkout",
    ].some((dangerousWord) => value.includes(dangerousWord));
}

async function collectHeadings(page: Page): Promise<string[]> {
    return page.locator("h1, h2, h3").evaluateAll((elements) =>
        elements
            .map((element) => element.textContent?.trim() ?? "")
            .filter(Boolean),
    );
}

async function collectInputs(page: Page): Promise<PageElementInfo[]> {
    return page.locator("input").evaluateAll((elements) =>
        elements.map((element) => {
            const input = element as HTMLInputElement;

            return {
                tagName: input.tagName.toLowerCase(),
                placeholder: input.getAttribute("placeholder") ?? undefined,
                testId: input.getAttribute("data-test") ?? undefined,
                text: input.value || undefined,
                isVisible: isElementVisible(input),
            };
        }),
    );
}

async function collectButtons(page: Page): Promise<PageElementInfo[]> {
    return page.locator("button, input[type='submit'], input[type='button']").evaluateAll((elements) =>
        elements.map((element) => {
            const htmlElement = element as HTMLElement;
            const inputElement = element as HTMLInputElement;

            return {
                tagName: htmlElement.tagName.toLowerCase(),
                text:
                    htmlElement.innerText?.trim() ||
                    inputElement.value ||
                    htmlElement.getAttribute("aria-label") ||
                    undefined,
                testId: htmlElement.getAttribute("data-test") ?? undefined,
                isVisible: isElementVisible(htmlElement),
            };
        }),
    );
}

async function collectLinks(page: Page): Promise<PageElementInfo[]> {
    return page.locator("a").evaluateAll((elements) =>
        elements.map((element) => {
            const link = element as HTMLAnchorElement;

            return {
                tagName: link.tagName.toLowerCase(),
                text: link.innerText?.trim() || undefined,
                href: link.href || undefined,
                testId: link.getAttribute("data-test") ?? undefined,
                isVisible: isElementVisible(link),
            };
        }),
    );
}

async function collectVisibleTexts(page: Page): Promise<string[]> {
    const texts = await page.locator("body").evaluate((body) => {
        const rawText = body.textContent ?? "";

        return rawText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    });

    return [...new Set(texts)].slice(0, 80);
}

function isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
    );
}

function normalizeUrl(url: string): string {
    const normalizedUrl = new URL(url);
    normalizedUrl.hash = "";

    return normalizedUrl.toString();
}

function isSameOrigin(baseUrl: string, targetUrl: string): boolean {
    return new URL(baseUrl).origin === new URL(targetUrl).origin;
}