/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Agent
 * @description Agent Preferences.test
 */

import { AgentPreferences } from "../../../../src/main/agent/agent-preferences";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

void test("settings publish only persisted changes and reject concurrent stale drafts", async () => {

    const root = await mkdtemp(join(tmpdir(), "avesd-settings-"));
    try {
        const preferences = await AgentPreferences.open(join(root, "preferences.json"));
        const revisions: number[] = [];
        const unsubscribe = preferences.subscribe(() => {

            revisions.push(preferences.revision);
        });
        const draft = {
            ...preferences.routes,
            reasoning: {
                providerId: "deepseek",
                modelId: "deepseek-v4-pro",
                effortId: "",
            },
        };
        const first = preferences.configureRoutes(draft, 0);
        const stale = preferences.configureRoutes(preferences.routes, 0);
        await first;
        await assert.rejects(stale, (error: unknown) => {

            assert.ok(error instanceof OperationError);
            assert.equal(error.code, IpcErrorCode.VersionConflict);
            assert.equal(error.currentRevision, 1);

            return true;
        });
        assert.deepEqual(revisions, [1]);
        assert.equal((await AgentPreferences.open(join(root, "preferences.json"))).routes.reasoning.modelId, "deepseek-v4-pro");
        await preferences.configureFlagship({
            providerId: "deepseek",
            modelId: "deepseek-flash",
            effortId: "",
        });
        assert.equal(preferences.routes.reasoning.modelId, "deepseek-v4-pro");
        assert.deepEqual(revisions, [
            1,
            2,
        ]);
        unsubscribe();
        await preferences.configureRoutes(preferences.routes, 2);
        assert.deepEqual(revisions, [
            1,
            2,
        ]);
    } finally {
        await rm(root, {
            recursive: true,
            force: true,
        });
    }
});

void test("failed persistence does not publish settings or advance the revision", async () => {

    const root = await mkdtemp(join(tmpdir(), "avesd-settings-"));
    try {
        const preferences = new AgentPreferences(join(root, "missing", "preferences.json"));
        let notified = false;
        preferences.subscribe(() => {

            notified = true;
        });
        await assert.rejects(preferences.configureRoutes(preferences.routes, 0));
        assert.equal(preferences.revision, 0);
        assert.equal(notified, false);
    } finally {
        await rm(root, {
            recursive: true,
            force: true,
        });
    }
});
