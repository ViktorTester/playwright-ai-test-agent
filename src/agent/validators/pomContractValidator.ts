import {existsSync, readFileSync} from "node:fs";
import type {SiteAnalysisResult, SiteFlowAction} from "../siteAnalyzer";

export type PomContractValidationResult = {
    readonly isValid: boolean;
    readonly checkedMethods: CheckedPomMethod[];
    readonly missingMethods: CheckedPomMethod[];
};

export type CheckedPomMethod = {
    readonly fromPage: string;
    readonly toPage: string;
    readonly pomMethod: string;
    readonly objectName: string;
    readonly methodName: string;
    readonly filePath: string;
    readonly exists: boolean;
};

const POM_OBJECT_TO_FILE: Record<string, string> = {
    loginPage: "src/pages/LoginPage.ts",
    inventoryPage: "src/pages/InventoryPage.ts",
    cartPage: "src/pages/CartPage.ts",
    checkoutPage: "src/pages/CheckoutPage.ts",
};

export function validatePomContract(analysis: SiteAnalysisResult): PomContractValidationResult {
    const checkedMethods = analysis.flowGraph.actions.map(validateFlowAction);
    const missingMethods = checkedMethods.filter((method) => !method.exists);

    return {
        isValid: missingMethods.length === 0,
        checkedMethods,
        missingMethods,
    };
}

function validateFlowAction(action: SiteFlowAction): CheckedPomMethod {
    const parsedMethod = parsePomMethod(action.pomMethod);
    const filePath = POM_OBJECT_TO_FILE[parsedMethod.objectName];

    if (!filePath || !existsSync(filePath)) {
        return {
            fromPage: action.fromPage,
            toPage: action.toPage,
            pomMethod: action.pomMethod,
            objectName: parsedMethod.objectName,
            methodName: parsedMethod.methodName,
            filePath: filePath ?? "UNKNOWN_FILE",
            exists: false,
        };
    }

    const fileContent = readFileSync(filePath, "utf-8");

    return {
        fromPage: action.fromPage,
        toPage: action.toPage,
        pomMethod: action.pomMethod,
        objectName: parsedMethod.objectName,
        methodName: parsedMethod.methodName,
        filePath,
        exists: hasMethod(fileContent, parsedMethod.methodName),
    };
}

function parsePomMethod(pomMethod: string): {
    readonly objectName: string;
    readonly methodName: string;
} {
    const match = pomMethod.match(/^([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)\(/);

    const objectName = match?.[1];
    const methodName = match?.[2];

    if (!objectName || !methodName) {
        throw new Error(`Invalid POM method format: ${pomMethod}`);
    }

    return {
        objectName,
        methodName,
    };
}

function hasMethod(fileContent: string, methodName: string): boolean {
    const methodPatterns = [
        new RegExp(`async\\s+${methodName}\\s*\\(`),
        new RegExp(`public\\s+async\\s+${methodName}\\s*\\(`),
        new RegExp(`${methodName}\\s*=\\s*async\\s*\\(`),
    ];

    return methodPatterns.some((pattern) => pattern.test(fileContent));
}