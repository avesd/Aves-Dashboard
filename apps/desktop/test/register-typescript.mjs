import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";

// Run the checked TypeScript sources without a separate build or runtime dependency.
registerHooks({
    resolve(specifier, context, nextResolve) {

        try {
            return nextResolve(specifier, context);
        } catch (error) {
            if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
                return nextResolve(`${specifier}.ts`, context);
            }
            throw error;
        }
    },
    load(url, context, nextLoad) {

        if (url.endsWith(".ts")) {
            return {
                format: "module",
                shortCircuit: true,
                source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), { mode: "transform" }),
            };
        }

        return nextLoad(url, context);
    },
});
