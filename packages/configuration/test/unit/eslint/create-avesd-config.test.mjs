/**
 * @author Avesd
 * @package Configuration
 * @namespace Test_Unit_ESLint
 * @description Maintained release sources remain linted while release output is ignored
 */

import { createAvesdConfig } from "../../../eslint/create-avesd-config.mjs";
import { ESLint } from "eslint";
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

function configuredLint(cwd) {

    return new ESLint({
        cwd,
        overrideConfigFile: true,
        overrideConfig: createAvesdConfig(cwd),
    });
}

void test("root lint includes maintained release tooling and ignores generated release output", async () => {

    const lint = configuredLint(root);

    const sourceIgnored = await lint.isPathIgnored("scripts/release/release-plan.ts");
    const nestedSourceIgnored = await lint.isPathIgnored("scripts/release/nested/source.ts");
    const workspaceOutputIgnored = await lint.isPathIgnored("apps/desktop/release/generated.js");
    const rootOutputIgnored = await lint.isPathIgnored("release/generated.js");

    assert.equal(sourceIgnored, false);
    assert.equal(nestedSourceIgnored, false);
    assert.equal(workspaceOutputIgnored, true);
    assert.equal(rootOutputIgnored, true);
});

void test("workspace lint retains its own generated-release exclusion", async () => {

    const lint = configuredLint(join(root, "apps/desktop"));

    const outputIgnored = await lint.isPathIgnored("release/generated.js");

    assert.equal(outputIgnored, true);
});
