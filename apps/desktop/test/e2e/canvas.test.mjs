import { createDesktopHarness, expect } from "./support/desktop.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const harness = await createDesktopHarness("canvas-windows");
const screenshots = process.env.AVESD_CANVAS_SCREENSHOTS;
try {
    const { app, page: controller } = await harness.launch(".controller.is-collapsed");
    const collapsed = await app.evaluate(({ BrowserWindow, screen }) => {

        const window = BrowserWindow.getAllWindows().find(item => {

            return item.getTitle() === "Avesd";
        });

        return {
            bounds: window.getBounds(),
            top: window.isAlwaysOnTop(),
            area: screen.getDisplayMatching(window.getBounds()).workArea,
        };
    });
    assert.equal(collapsed.top, true);
    assert.equal(collapsed.bounds.width, 204);
    assert.equal(collapsed.bounds.height, 48);
    assert.equal(collapsed.bounds.x + collapsed.bounds.width, collapsed.area.x + collapsed.area.width - 12);
    if (screenshots) {
        await mkdir(screenshots, { recursive: true }); await controller.screenshot({
            animations: "disabled",
            path: join(screenshots, "controller-collapsed.png"),
        });
    }
    await controller.getByRole("button", {
        name: "Open controller",
        exact: true,
    }).click();
    await expect(controller.getByRole("textbox", { name: "Message your agent" })).toBeFocused();
    if (screenshots) {
        await controller.screenshot({
            animations: "disabled",
            path: join(screenshots, "controller-expanded.png"),
        });
    }
    const ids = await controller.evaluate(async () => {

        const first = await window.avesd.canvases.create("synthetic-create-a", "Synthetic research");
        const second = await window.avesd.canvases.create("synthetic-create-b", "Synthetic notes");
        await window.avesd.views.open(first.canvasId);
        await window.avesd.views.open(second.canvasId);

        return [
            first.canvasId,
            second.canvasId,
        ];
    });
    await expect.poll(async () => {

        return (await app.windows()).length;
    }).toBe(3);
    const pages = await app.windows();
    const first = pages.find(page => {

        return page !== controller && page.url() === controller.url();
    });
    assert.ok(first);
    const canvasPages = pages.filter(page => {

        return page !== controller;
    });
    const findPage = async id => {

        for (const page of canvasPages) {
            if ((await page.evaluate(() => {

                return window.avesd.views.inspect();
            })).canvasId === id) {
                return page;
            }
        }
        throw new Error("Canvas view missing");
    };
    const research = await findPage(ids[0]);
    const notes = await findPage(ids[1]);
    await expect(research.getByRole("button")).toHaveCount(0);
    if (screenshots) {
        await research.screenshot({
            animations: "disabled",
            path: join(screenshots, "dashboard-empty.png"),
        });
    }
    await research.getByLabel("Dashboard surface").dblclick({
        position: {
            x: 500,
            y: 300,
        },
    });
    await expect(research.locator(".canvas-item")).toHaveCount(0);
    await expect(research.locator(".canvas-empty")).toHaveCount(0);
    await controller.evaluate(async id => {

        const state = await window.avesd.canvases.read(id);
        await window.avesd.canvases.apply("synthetic-agent-add", id, state.revision, [
            {
                type: "add",
                item: {
                    id: "synthetic-agent-idea",
                    content: {
                        kind: "idea",
                        version: 1,
                        text: "Synthetic research finding",
                    },
                    placement: {
                        x: 360,
                        y: 250,
                        width: 280,
                        height: 180,
                    },
                },
            },
        ]);
    }, ids[0]);
    await expect(research.getByText("Synthetic research finding", { exact: true })).toBeVisible();
    await expect(notes.locator(".canvas-item")).toHaveCount(0);
    await research.getByText("Synthetic research finding").dblclick();
    await expect(research.locator(".canvas-item.is-selected")).toHaveCount(1);
    await expect(research.getByRole("textbox")).toHaveCount(0);
    await research.keyboard.press("Delete");
    await research.keyboard.press("Control+z");
    const card = await research.locator(".canvas-card").boundingBox();
    await research.mouse.move(card.x + 30, card.y + 30);
    await research.mouse.down();
    await research.mouse.move(card.x + 100, card.y + 80);
    await research.mouse.up();
    const unchanged = await controller.evaluate(id => {

        return window.avesd.canvases.read(id);
    }, ids[0]);
    assert.equal(unchanged.revision, 1);
    assert.equal(unchanged.items[0].placement.x, 360);
    const before = await research.locator(".canvas-world").getAttribute("style");
    await research.mouse.move(30, 30);
    await research.mouse.down();
    await research.mouse.move(90, 80);
    await research.mouse.up();
    await expect(research.locator(".canvas-world")).not.toHaveAttribute("style", before);
    const beforeZoom = await research.locator(".dashboard-zoom").textContent();
    await research.mouse.wheel(0, -120);
    await expect(research.locator(".dashboard-zoom")).not.toHaveText(beforeZoom);
    const denied = await research.evaluate(async other => {

        try {
            await window.avesd.canvases.read(other);

            return false;
        } catch { return true; }
    }, ids[1]);
    assert.equal(denied, true, "A canvas renderer cannot read another canvas");
    const researchView = await research.evaluate(() => {

        return window.avesd.views.inspect();
    });
    await controller.evaluate(id => {

        return window.avesd.views.close(id);
    }, researchView.viewId);
    const gateway = await harness.gateway();
    const base = new URL("/v1/", gateway.url);
    const headers = {
        authorization: `Bearer ${gateway.token}`,
        "content-type": "application/json",
    };
    const read = await (await fetch(new URL(`canvases/${ids[0]}`, base), { headers })).json();
    assert.equal(read.ok, true);
    const renamed = await fetch(new URL(`canvases/${ids[0]}/rename`, base), {
        method: "POST",
        headers,
        body: JSON.stringify({
            requestId: "synthetic-rename",
            expectedRevision: read.value.revision,
            title: "Synthetic organized research",
        }),
    });
    assert.equal(renamed.status, 200);
    const opening = app.waitForEvent("window");
    await controller.evaluate(id => {

        return window.avesd.views.open(id);
    }, ids[0]);
    const reopened = await opening;
    assert.ok(reopened);
    await expect(reopened.locator(".canvas-shell")).toHaveAttribute("aria-label", "Synthetic organized research");
    await expect(reopened.getByText("Synthetic research finding", { exact: true })).toBeVisible();
    if (screenshots) {
        await reopened.screenshot({
            animations: "disabled",
            path: join(screenshots, "canvas.png"),
        });
    }
    const nativeBounds = await app.evaluate(({ BrowserWindow }) => {

        const window = BrowserWindow.getAllWindows().find(item => {

            return item.getTitle() === "Synthetic organized research";
        });
        window.setSize(560, 400);

        return window.getBounds();
    }, ids[0]);
    assert.equal(nativeBounds.width, 560);
    await reopened.getByLabel("Dashboard surface").click({
        button: "right",
        position: {
            x: 20,
            y: 20,
        },
    });
    if (screenshots) {
        await reopened.screenshot({
            animations: "disabled",
            path: join(screenshots, "dashboard-menu.png"),
        });
    }
    await reopened.getByRole("menuitem", { name: "Show all" }).click();
    if (screenshots) {
        await reopened.screenshot({
            animations: "disabled",
            path: join(screenshots, "canvas-narrow.png"),
        });
    }
    const executable = join(harness.directory, "synthetic-acp.mjs");
    await writeFile(executable, `#!${process.execPath}\nif (process.argv.includes('--version')) { console.log('synthetic-acp 1.0.0'); process.exit(0); }\nprocess.argv[2] = 'synthetic';\nawait import(${JSON.stringify(pathToFileURL(join(import.meta.dirname, "support/acp-agent.mjs")).href)});\n`, { mode: 0o700 });
    await controller.evaluate(async executable => {

        await window.avesd.agentProviders.configure("opencode", {
            enabled: true,
            executablePath: executable,
        });
        await window.avesd.agentSessions.configure(Object.fromEntries([
            "flagship",
            "reasoning",
            "action",
        ].map(tier => {

            return [
                tier,
                {
                    providerId: "opencode",
                    modelId: "",
                    effortId: "",
                },
            ];
        })));
    }, executable);
    await controller.evaluate(() => {

        return window.avesd.views.controller(true);
    });
    await controller.getByRole("textbox", { name: "Message your agent" }).fill("Synthetic conversation smoke test");
    await controller.getByRole("button", { name: "Send message" }).click();
    await expect(controller.getByText("synthetic/fast", { exact: true })).toBeVisible();
    await expect.poll(() => {

        return controller.evaluate(async () => {

            const listing = await window.avesd.agentSessions.list();

            return listing.sessions.find(item => {

                return item.id === listing.selectedId;
            })?.status;
        });
    }).toBe("completed");
    if (screenshots) {
        await controller.screenshot({
            animations: "disabled",
            path: join(screenshots, "controller-conversation.png"),
        });
    }
    await controller.getByRole("button", {
        name: "Dashboards",
        exact: true,
    }).click();
    await expect(controller.getByRole("button", {
        name: "Synthetic organized research",
        exact: true,
    })).toBeVisible();
    await controller.getByRole("button", {
        name: "Collapse",
        exact: true,
    }).click();
    await expect(controller.locator(".controller.is-collapsed")).toBeVisible();
    await harness.close();
    const restarted = await harness.launch(".controller.is-collapsed");
    const persisted = await restarted.page.evaluate(id => {

        return window.avesd.canvases.read(id);
    }, ids[0]);
    assert.equal(persisted.title, "Synthetic organized research");
    assert.equal(persisted.items[0].content.text, "Synthetic research finding");
    console.log("Canvas service and native windows passed; synthetic ACP conversation passed.");
} finally { await harness.dispose(); }
