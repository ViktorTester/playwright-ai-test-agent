import {chromium, type Page} from "@playwright/test";

export type PageElementInfo = {
    role?: string;
    text?: string;
    placeholder?: string;
    testId?: string;
    href?: string;
    tagName: string;
    isVisible: boolean;
};

export type SiteAnalysisResult = {
    baseUrl: string;
    pageTitle: string;
    currentUrl: string;
    headings: string[];
    inputs: PageElementInfo[];
    buttons: PageElementInfo[];
    links: PageElementInfo[];
    visibleTexts: string[];
};

export async function analyzeSite(baseUrl: string): Promise<SiteAnalysisResult> {
    const browser = await chromium.launch({
        headless: true,
    });

    const page = await browser.newPage();

    try {
        await page.goto(baseUrl, {
            waitUntil: "domcontentloaded",
        });

        await page.waitForLoadState("networkidle");

        return {
            baseUrl,
            pageTitle: await page.title(),
            currentUrl: page.url(),
            headings: await collectHeadings(page),
            inputs: await collectInputs(page),
            buttons: await collectButtons(page),
            links: await collectLinks(page),
            visibleTexts: await collectVisibleTexts(page),
        };
    } finally {
        await browser.close();
    }
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
    return page.locator("input").evaluateAll((elements) =>
        elements.map((element) => {
            const input = element as HTMLInputElement;
            const style = window.getComputedStyle(input);
            const rect = input.getBoundingClientRect();

            const isVisible =
                style.visibility !== "hidden" &&
                style.display !== "none" &&
                rect.width > 0 &&
                rect.height > 0;

            return {
                tagName: input.tagName.toLowerCase(),
                placeholder: input.getAttribute("placeholder") ?? undefined,
                testId: input.getAttribute("data-test") ?? undefined,
                text: input.value || undefined,
                isVisible,
            };
        }),
    );
}

async function collectButtons(page: Page): Promise<PageElementInfo[]> {
    return page
        .locator("button, input[type='submit'], input[type='button']")
        .evaluateAll((elements) =>
            elements.map((element) => {
                const htmlElement = element as HTMLElement;
                const inputElement = element as HTMLInputElement;
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
                        undefined,
                    testId: htmlElement.getAttribute("data-test") ?? undefined,
                    isVisible,
                };
            }),
        );
}

async function collectLinks(page: Page): Promise<PageElementInfo[]> {
    return page.locator("a").evaluateAll((elements) =>
        elements.map((element) => {
            const link = element as HTMLAnchorElement;
            const style = window.getComputedStyle(link);
            const rect = link.getBoundingClientRect();

            const isVisible =
                style.visibility !== "hidden" &&
                style.display !== "none" &&
                rect.width > 0 &&
                rect.height > 0;

            return {
                tagName: link.tagName.toLowerCase(),
                text: link.innerText?.trim() || undefined,
                href: link.href || undefined,
                testId: link.getAttribute("data-test") ?? undefined,
                isVisible,
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

    return [...new Set(texts)].slice(0, 50);
}