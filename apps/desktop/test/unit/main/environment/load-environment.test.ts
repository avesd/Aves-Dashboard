/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Environment
 * @description Load Environment.test
 */

import { loadEnvironment } from "../../../../src/main/environment/load-environment";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

void test("dotenv loads stage overrides, preserves process values, and ignores unapproved keys", () => {

    const root = mkdtempSync(join(tmpdir(), "avesd-env-"));
    try {
        writeFileSync(join(root, ".env.development"), "DEEPSEEK_MODEL=base\nDEEPSEEK_API_KEY=base");
        writeFileSync(join(root, ".env.local"), "DEEPSEEK_MODEL=local");
        writeFileSync(join(root, ".env.development.local"), "DEEPSEEK_MODEL=stage\nOPENAI_API_KEY=synthetic\nUNAPPROVED=ignored");
        const env: NodeJS.ProcessEnv = { DEEPSEEK_API_KEY: "process" };
        loadEnvironment(root, "development", env);
        assert.deepEqual(env, {
            DEEPSEEK_API_KEY: "process",
            DEEPSEEK_MODEL: "stage",
            OPENAI_API_KEY: "synthetic",
        });
    } finally {
        rmSync(root, {
            recursive: true,
            force: true,
        });
    }
});
