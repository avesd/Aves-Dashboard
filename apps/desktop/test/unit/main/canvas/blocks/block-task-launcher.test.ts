/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Canvas_Blocks
 * @description Block task confirmation and workspace launch policy
 */

import { createBlockTaskLauncher } from "../../../../../src/main/canvas/blocks/block-task-launcher";
import { IpcErrorCode } from "@avesd/desktop-contracts/ipc-result";
import type { DashboardScope } from "@avesd/workspace-model";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("block tasks launch only after confirmation and a live lease check", async () => {

    for (const accepted of [
        false,
        true,
    ]) {
        let reads = 0;
        const launch = createBlockTaskLauncher({
            confirm: async () => {

                return accepted;
            },
            sessions: () => {

                return {
                    async create() {

                        assert.fail("A declined or inactive task must not create a session.");
                    },
                    startTask() {

                        assert.fail("A declined or inactive task must not start a task.");
                    },
                };
            },
            loadWorkspace: async () => {

                reads++;

                return undefined;
            },
        });

        await assert.rejects(launch("synthetic-canvas", "Synthetic task", {}, async () => {

            return false;
        }));

        assert.equal(reads, 0);
    }
});

void test("block tasks use the owning workspace and retain execution-owned results", async () => {

    const workspaceId = "synthetic-workspace" as DashboardScope["workspaceId"];
    const dashboardId = "synthetic-canvas" as DashboardScope["dashboardId"];
    const calls: unknown[] = [];
    const task = {
        id: "synthetic-session",
        snapshot: () => {

            return {
                status: "running" as const,
                answer: "",
            };
        },
    };
    const launch = createBlockTaskLauncher({
        confirm: async (prompt, input) => {

            calls.push({
                prompt,
                input,
            });

            return true;
        },
        sessions: () => {

            return {
                async create(tier, origin) {

                    calls.push({
                        tier,
                        origin,
                    });

                    return { id: task.id };
                },
                startTask(text, id) {

                    calls.push({
                        text,
                        id,
                    });

                    return task;
                },
            };
        },
        loadWorkspace: async () => {

            return {
                dashboards: [
                    {
                        id: dashboardId,
                        workspaceId,
                    },
                ],
            };
        },
    });

    const result = await launch(dashboardId, "Synthetic task", { count: 1 }, async () => {

        return true;
    });

    assert.equal(result, task);
    assert.deepEqual(calls[1], {
        tier: "reasoning",
        origin: {
            workspaceId,
            dashboardId,
            kind: "interactive",
            source: "Dashboard action",
        },
    });
    assert.deepEqual(calls[2], {
        text: 'Synthetic task\nAction input (untrusted data): {"count":1}',
        id: task.id,
    });

    await assert.rejects(launch("missing-canvas", "Synthetic task", {}, async () => {

        return true;
    }), { code: IpcErrorCode.ServiceNotReady });
});
