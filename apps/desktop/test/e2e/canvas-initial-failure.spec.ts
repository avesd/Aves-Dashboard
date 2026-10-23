/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Verify failed initial block placeholders are owned through replacement and removal
 */

import { expect, test } from "./desktop-fixture";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";
import type { WorkspaceSnapshot } from "@avesd/workspace-model";

test("initial failures keep one placeholder and repair and removal leave no stale hosts", async ({ desktop, controller }, testInfo) => {

    const fixture = await desktop.evaluateHandle(async ({ app, BrowserWindow }) => {

        const { readFile, writeFile } = process.getBuiltinModule("node:fs/promises");
        const { join } = process.getBuiltinModule("node:path");
        const path = join(app.getPath("userData"), "workspace-v1.json");
        // All profile data is created by the disposable desktop fixture.
        const snapshot = JSON.parse(await readFile(path, "utf8")) as WorkspaceSnapshot;
        const dashboard = snapshot.dashboards[0]!;
        const block = {
            id: "synthetic-error",
            generation: crypto.randomUUID(),
            description: "Synthetic initial failure",
            source: {
                html: "<p>Synthetic repaired block</p>",
                css: "body{padding:16px;background:#e7efeb;color:#253c34}",
                js: "document.head.host.parentElement.dataset.attempt='1';throw new Error('Synthetic initialization failure')",
            },
            bounds: {
                x: 32,
                y: 32,
                width: 320,
                height: 160,
            },
            revision: 1,
            data: {},
            dataRevision: 0,
            viewState: {},
            stateRevision: 0,
            bindings: [],
            actions: [],
            question: null,
        };
        const blocks = [block];
        const save = async () => {

            const next = {
                ...snapshot,
                dashboards: snapshot.dashboards.map(current => {

                    return current.id === dashboard.id ? {
                        ...current,
                        viewState: {
                            ...current.viewState,
                            blocks,
                        },
                    } : current;
                }),
            };
            await writeFile(path, JSON.stringify(next));
            for (const window of BrowserWindow.getAllWindows()) {
                window.webContents.send("canvas-service:changed", {
                    type: "reset",
                    epoch: "synthetic",
                    sequence: 1,
                });
            }
        };
        await save();

        return {
            canvasId: dashboard.id,
            async replace(revision: number, fail: boolean) {

                block.revision = revision;
                if (fail) {
                    block.source.js = `document.head.host.parentElement.dataset.attempt='${revision}';throw new Error('Synthetic initialization failure')`;
                } else {
                    block.source.js = "document.head.host.dataset.repaired='true'";
                }
                await save();
            },
            async remove() {

                blocks.length = 0;
                await save();
            },
        };
    });
    const canvasId = await fixture.evaluate(value => {

        return value.canvasId;
    });
    const opened = desktop.waitForEvent("window");
    await controller.evaluate(async id => {

        const api = (globalThis as unknown as {
            avesdController: WireApi<ControllerApi>;
        }).avesdController;
        const result = await api.views.open(id);
        if (!result.ok) {
            throw new Error("Synthetic canvas could not open");
        }
    }, canvasId);
    const canvas = await opened;
    await canvas.waitForURL("**/canvas.html*");
    const frame = canvas.frameLocator('iframe[title="Canvas blocks"]');
    await expect(frame.locator("#world")).toHaveAttribute("data-attempt", "1");
    await expect(frame.locator("#world > .block")).toHaveCount(1);

    await fixture.evaluate(value => {

        return value.replace(2, true);
    });
    await expect(frame.locator("#world")).toHaveAttribute("data-attempt", "2");
    await expect(frame.locator("#world > .block")).toHaveCount(1);
    await canvas.screenshot({
        animations: "disabled",
        clip: {
            x: 0,
            y: 0,
            width: 420,
            height: 240,
        },
        path: testInfo.outputPath("initial-failure.png"),
    });

    await fixture.evaluate(value => {

        return value.replace(3, false);
    });
    await expect(frame.locator('[data-repaired="true"]')).toHaveCount(1);
    await expect(frame.locator("#world > .block")).toHaveCount(1);
    await canvas.screenshot({
        animations: "disabled",
        clip: {
            x: 0,
            y: 0,
            width: 420,
            height: 240,
        },
        path: testInfo.outputPath("repaired.png"),
    });

    await fixture.evaluate(value => {

        return value.remove();
    });
    await expect(frame.locator("#world > .block")).toHaveCount(0);
    await canvas.screenshot({
        animations: "disabled",
        clip: {
            x: 0,
            y: 0,
            width: 420,
            height: 240,
        },
        path: testInfo.outputPath("removed.png"),
    });
});
