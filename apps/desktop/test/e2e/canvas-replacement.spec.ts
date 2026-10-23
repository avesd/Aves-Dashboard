/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Verify native block replacement capacity recovery and same-version mount retries
 */

import { expect, test } from "./desktop-fixture";
import type { BlockMount } from "@avesd/desktop-contracts/canvas/blocks";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { CanvasApi } from "@avesd/renderer-canvas/contracts";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";
import type { WorkspaceSnapshot } from "@avesd/workspace-model";

test("failed replacements preserve the display and capacity for repair, and rejected mounts retry", async ({ desktop, controller }, testInfo) => {

    const fixture = await desktop.evaluateHandle(async ({ app, BrowserWindow }) => {

        const { readFile, writeFile } = process.getBuiltinModule("node:fs/promises");
        const { join } = process.getBuiltinModule("node:path");
        const path = join(app.getPath("userData"), "workspace-v1.json");
        // The desktop fixture redirects this entire profile to disposable synthetic storage.
        const snapshot = JSON.parse(await readFile(path, "utf8")) as WorkspaceSnapshot;
        const dashboard = snapshot.dashboards[0]!;
        const blocks = Array.from({ length: 64 }, (_, index) => {

            return {
                id: `synthetic-${index}`,
                generation: crypto.randomUUID(),
                description: "Synthetic lifecycle block",
                source: {
                    html: `<p>Synthetic block ${index}</p>`,
                    css: "body{padding:16px;background:#e7efeb;color:#253c34}",
                    js: "document.head.host.dataset.sourceRevision='1'",
                },
                bounds: {
                    x: (index % 4) * 220,
                    y: Math.floor(index / 4) * 140,
                    width: 200,
                    height: 120,
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
        });
        const invalidate = () => {

            for (const window of BrowserWindow.getAllWindows()) {
                window.webContents.send("canvas-service:changed", {
                    type: "reset",
                    epoch: "synthetic",
                    sequence: 1,
                });
            }
        };
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
            invalidate();
        };
        await save();

        return {
            canvasId: dashboard.id,
            invalidate,
            async replace(revision: number) {

                for (const block of blocks) {
                    if (revision === 4 && block.id !== "synthetic-0") {
                        continue;
                    }
                    block.revision = revision;
                    if (revision === 2) {
                        block.source.js = "const world=document.head.host.parentElement;world.dataset.failures=String(Number(world.dataset.failures??0)+1);throw new Error('Synthetic replacement failure')";
                    } else {
                        block.source.js = `document.head.host.dataset.sourceRevision='${revision}'`;
                    }
                }
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
    await expect(frame.locator('[data-source-revision="1"]')).toHaveCount(64);

    await fixture.evaluate(value => {

        return value.replace(2);
    });
    // A failed candidate is disposed by the sandbox, leaving only the previous visible roots.
    await expect(frame.locator("#world")).toHaveAttribute("data-failures", "64");
    await expect(frame.locator("#world > .block")).toHaveCount(64);
    await expect(frame.locator('[data-source-revision="1"]')).toHaveCount(64);
    await canvas.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("failed-retains-display.png"),
    });

    await fixture.evaluate(value => {

        return value.replace(3);
    });
    await expect(frame.locator('[data-source-revision="3"]')).toHaveCount(64);
    await expect(canvas.locator(".canvas-error")).toBeHidden();
    await canvas.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("repaired-display.png"),
    });

    // Occupy the remaining real host capacity independently of the renderer's leases.
    const extra = await canvas.evaluateHandle(() => {

        return [] as string[];
    });
    await expect.poll(async () => {

        return extra.evaluate(async leases => {

            const api = (globalThis as unknown as {
                avesdCanvas: WireApi<CanvasApi>;
            }).avesdCanvas;
            const view = await api.views.inspect();
            if (!view.ok || !view.value.canvasId) {
                throw new Error("Synthetic canvas is unavailable");
            }
            const document = await api.canvases.read(view.value.canvasId);
            if (!document.ok) {
                throw new Error("Synthetic canvas is unreadable");
            }
            const block = document.value.blocks[0]!;
            while (leases.length < 64) {
                const mounted = await api.blocks.invoke({
                    type: "mount",
                    canvasId: view.value.canvasId,
                    blockId: block.id,
                    generation: block.generation,
                    revision: block.revision,
                });
                if (!mounted.ok) {
                    break;
                }
                leases.push((mounted.value as BlockMount).leaseId);
            }

            return leases.length;
        });
    }).toBe(64);
    await fixture.evaluate(value => {

        return value.replace(4);
    });
    await expect(canvas.locator(".canvas-error")).toBeVisible();
    await expect(frame.locator('[data-source-revision="3"]')).toHaveCount(64);

    await extra.evaluate(async leases => {

        const api = (globalThis as unknown as {
            avesdCanvas: WireApi<CanvasApi>;
        }).avesdCanvas;
        const released = await api.blocks.invoke({
            type: "release",
            leaseId: leases.pop()!,
        });
        if (!released.ok) {
            throw new Error("Synthetic capacity could not be released");
        }
    });
    await fixture.evaluate(value => {

        return void value.invalidate();
    });

    await expect(frame.locator('[data-source-revision="4"]')).toHaveCount(1);
    await expect(frame.locator('[data-source-revision="3"]')).toHaveCount(63);
    await expect(canvas.locator(".canvas-error")).toBeHidden();
});
