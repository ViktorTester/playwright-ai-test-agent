import {test} from "@playwright/test";

export function step(template?: string): any {
    return function (...decoratorArguments: unknown[]) {
        if (isStageThreeMethodDecorator(decoratorArguments)) {
            const [originalMethod, context] = decoratorArguments;

            return async function (this: object, ...methodArguments: unknown[]): Promise<unknown> {
                const stepName = resolveStepName(this, String(context.name), template, methodArguments);

                return test.step(stepName, async () => originalMethod.apply(this, methodArguments));
            };
        }

        const [, propertyKey, descriptor] = decoratorArguments as [object, string | symbol, PropertyDescriptor];
        const originalMethod = descriptor.value as (...methodArguments: unknown[]) => Promise<unknown> | unknown;

        descriptor.value = async function (this: object, ...methodArguments: unknown[]): Promise<unknown> {
            const stepName = resolveStepName(this, String(propertyKey), template, methodArguments);

            return test.step(stepName, async () => originalMethod.apply(this, methodArguments));
        };

        return descriptor;
    };
}

function isStageThreeMethodDecorator(
    decoratorArguments: unknown[],
): decoratorArguments is [
    (this: object, ...methodArguments: unknown[]) => Promise<unknown> | unknown,
    ClassMethodDecoratorContext,
] {
    const [originalMethod, context] = decoratorArguments;

    return (
        typeof originalMethod === "function" &&
        typeof context === "object" &&
        context !== null &&
        "kind" in context &&
        (context as ClassMethodDecoratorContext).kind === "method"
    );
}

function resolveStepName(
    instance: object,
    methodName: string,
    template: string | undefined,
    methodArguments: unknown[],
): string {
    if (template) {
        return formatStepName(template, methodArguments);
    }

    return `${instance.constructor.name}.${methodName}`;
}

function formatStepName(template: string, args: unknown[]): string {
    return template.replace(/\{(\d+)}/g, (_, index: string) => String(args[Number(index)]));
}
