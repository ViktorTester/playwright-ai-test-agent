import {chromium, type Browser, type Locator, type Page} from "@playwright/test";

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
};

type RawPageElementInfo = Omit<PageElementInfo, "recommendedLocator">;

export async function analyzeSite(baseUrl: string): Promise<SiteAnalysisResult> {
    const browser = await chromium.launch({
        headless: true,
    });

    try {
        const page = await browser.newPage();

        await page.goto(baseUrl, {
            waitUntil: "domcontentloaded",
        });

        await page.waitForLoadState("networkidle");

        const pageAnalysis = await analyzeCurrentPage(page);

        return {
            baseUrl,
            analyzedAt: new Date().toISOString(),
            pages: [pageAnalysis],
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

    if (normalizedUrl.includes("cart") || headingText.includes("cart")) {
        return "Cart page";
    }

    if (normalizedUrl.includes("checkout") || headingText.includes("checkout")) {
        return "Checkout page";
    }

    if (headingText.includes("products")) {
        return "Inventory page";
    }

    if (normalizedTitle.includes("swag labs")) {
        return "Login page";
    }

    return "Unknown page";
}

async function closeBrowser(browser: Browser): Promise<void> {
    await browser.close();
}