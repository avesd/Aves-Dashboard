/**
 * @author Avesd
 * @package Configuration
 * @namespace Test_Unit_Eslint
 * @description Configuration integration tests
 */

import { createAvesdConfig } from "../../../eslint/create-avesd-config.mjs";
import { ESLint } from "eslint";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const createLinter = (options = {}) => {

    return new ESLint({
        overrideConfigFile: true,
        overrideConfig: createAvesdConfig(),
        ...options,
    });
};

test("JavaScript catches undefined references while allowing Node globals", async () => {

    const [result] = await createLinter().lintText("missingFunction();\nconsole.log(process.version);\n", { filePath: "scripts/probe.mjs" });
    const undefinedReferences = result.messages.filter((message) => {

        return message.ruleId === "no-undef";
    });
    assert.equal(undefinedReferences.length, 1);
    assert.match(undefinedReferences[0].message, /missingFunction/);
});

test("React rules reject conditional Hooks and missing effect dependencies", async () => {

    const [result] = await createLinter().lintText(`
import { useEffect, useState } from "react";
export const View = ({ enabled, value }) => {
    if (enabled) {
        useState(0);
    }
    useEffect(() => {
        console.log(value);
    }, []);
    return null;
};
`, { filePath: "src/probe.jsx" });
    for (const rule of [
        "react-hooks/rules-of-hooks",
        "react-hooks/exhaustive-deps",
    ]) {
        assert.ok(result.messages.some((message) => {

            return message.ruleId === rule;
        }), JSON.stringify(result.messages));
    }
});

test("typed lint covers source and tests without duplicate no-undef diagnostics", async (context) => {

    const root = mkdtempSync(join(tmpdir(), "avesd-eslint-"));
    context.after(() => {

        rmSync(root, {
            recursive: true,
            force: true,
        });
    });
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
            strict: true,
            target: "ES2023",
            module: "ESNext",
            moduleResolution: "Bundler",
            noEmit: true,
        },
        include: [
            "src/**/*.ts",
            "test/**/*.ts",
        ],
    }));
    const linter = createLinter({
        cwd: root,
        overrideConfig: createAvesdConfig(root),
    });
    for (const directory of [
        "src",
        "test/unit",
    ]) {
        mkdirSync(join(root, directory), { recursive: true });
        const file = join(root, directory, "probe.ts");
        writeFileSync(file, "Promise.resolve(1);\n");
        const [result] = await linter.lintFiles([file]);
        assert.ok(result.messages.some((message) => {

            return message.ruleId === "@typescript-eslint/no-floating-promises";
        }), JSON.stringify(result.messages));
        const config = await linter.calculateConfigForFile(file);
        assert.equal(config.rules["no-undef"][0], 0);
    }
});

test("generated files are excluded at any depth and fixes are idempotent", async () => {

    const linter = createLinter({ fix: true });
    for (const file of [
        "dist/output.js",
        "nested/out/output.js",
        "nested/coverage/report.js",
        "nested/.turbo/cache.js",
    ]) {
        assert.equal(await linter.isPathIgnored(file), true, file);
    }
    const [first] = await linter.lintText("export const run = () => { return 1 };\n", { filePath: "src/probe.mjs" });
    assert.ok(first.output);
    assert.equal(first.errorCount, 0, JSON.stringify(first.messages));
    const [second] = await linter.lintText(first.output, { filePath: "src/probe.mjs" });
    assert.equal(second.output, undefined);
    assert.equal(second.errorCount, 0);
});
