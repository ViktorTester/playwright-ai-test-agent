import {test} from '@playwright/test';

export function step(template?: string) {
    return function <This, Args extends unknown[], Return>(
        originalMethod: (this: This, ...args: Args) => Promise<Return> | Return,
        context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return> | Return>
    ) {
        return async function (this: This, ...args: Args): Promise<Return> {
            const defaultName = `${(this as { constructor: { name: string } }).constructor.name}.${String(context.name)}`;

            const stepName = template
                ? template.replace(/\{(\d+)}/g,
                    (_, index) => String(args[Number(index)]))
                : defaultName;

            return await test.step(stepName, async () => {
                return originalMethod.apply(this, args);
            });
        };
    };
}



