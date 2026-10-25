/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Block-local document selectors preserve HTML identity, styling, and scope
 */

import { expect, test } from "./desktop-fixture";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";
import type { WorkspaceSnapshot } from "@avesd/workspace-model";

test("block-local HTML and body selectors agree with document properties and scoped styles", async ({ desktop, controller }) => {

    const canvasId = await desktop.evaluate(async ({ app, BrowserWindow }) => {

        const { readFile, writeFile } = process.getBuiltinModule("node:fs/promises");
        const { join } = process.getBuiltinModule("node:path");
        const path = join(app.getPath("userData"), "workspace-v1.json");
        // The fixture owns this disposable profile; no real workspace is read or written.
        const snapshot = JSON.parse(await readFile(path, "utf8")) as WorkspaceSnapshot;
        const dashboard = snapshot.dashboards[0]!;
        const block = {
            id: "synthetic-selectors",
            generation: crypto.randomUUID(),
            description: "Synthetic local document selectors",
            source: {
                html: '<span id="synthetic-marker" class="synthetic-marker">Synthetic selector probe</span>',
                css: "html.synthetic-html .synthetic-marker { color: rgb(17, 34, 51); }",
                js: `
const html = document.querySelector('html');
const body = document.querySelector('body');
const marker = document.querySelector('.synthetic-marker');
html.classList.add('synthetic-html');
const host = document.head.host;
host.dataset.htmlLocal = String(html === document.documentElement);
host.dataset.bodyLocal = String(body === document.body);
host.dataset.distinctRoots = String(html !== body);
host.dataset.htmlCollection = String(document.querySelectorAll('html')[0] === html);
host.dataset.bodyCollection = String(document.querySelectorAll('body')[0] === body);
host.dataset.markerLocal = String(marker === document.getElementById('synthetic-marker'));
host.dataset.outerHidden = String(document.querySelector('#world') === null);
host.dataset.selectorColor = getComputedStyle(marker).color;
`,
            },
            bounds: {
                x: 24,
                y: 24,
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
        await writeFile(path, JSON.stringify({
            ...snapshot,
            dashboards: snapshot.dashboards.map(current => {

                if (current.id !== dashboard.id) {
                    return current;
                }

                return {
                    ...current,
                    viewState: {
                        ...current.viewState,
                        blocks: [block],
                    },
                };
            }),
        }));
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("canvas-service:changed", {
                type: "reset",
                epoch: "synthetic",
                sequence: 1,
            });
        }

        return dashboard.id;
    });

    const opened = desktop.waitForEvent("window");
    await controller.evaluate(async id => {

        const api = (globalThis as unknown as {
            avesdController: WireApi<ControllerApi>;
        }).avesdController;
        const result = await api.views.open(id);
        if (!result.ok) {
            throw new Error("Synthetic canvas could not open.");
        }
    }, canvasId);
    const canvas = await opened;
    await canvas.waitForURL("**/canvas.html*");
    const frame = canvas.frameLocator('iframe[title="Canvas blocks"]');
    const host = frame.locator('[data-block-id="synthetic-selectors"]');

    await expect(host).toHaveAttribute("data-html-local", "true");
    await expect(host).toHaveAttribute("data-body-local", "true");
    await expect(host).toHaveAttribute("data-distinct-roots", "true");
    await expect(host).toHaveAttribute("data-html-collection", "true");
    await expect(host).toHaveAttribute("data-body-collection", "true");
    await expect(host).toHaveAttribute("data-marker-local", "true");
    await expect(host).toHaveAttribute("data-outer-hidden", "true");
    await expect(host).toHaveAttribute("data-selector-color", "rgb(17, 34, 51)");
});
