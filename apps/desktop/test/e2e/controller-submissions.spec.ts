/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Verify independent Controller submissions through native preload IPC
 */

import { expect, test } from "./desktop-fixture";

test("pending conversation submissions remain independent and preserve supplements and cancellation", async ({ desktop, controller }, testInfo) => {

    // Hold synthetic host responses while exercising the production renderer and preload.
    const state = await desktop.evaluateHandle(({ ipcMain, BrowserWindow }) => {

        const sessions = Object.fromEntries([
            "a",
            "b",
        ].map(id => {

            return [
                id,
                {
                    id,
                    kind: "interactive",
                    tier: "flagship",
                    source: "synthetic",
                    createdAt: 0,
                    status: "idle",
                    route: { providerId: `synthetic-${id}` },
                    waitingForAnswer: false,
                    queuedPrompts: [] as {
                        id: string;
                        text: string;
                    }[],
                    events: [],
                },
            ];
        }));
        let selectedId = "a";
        const calls: {
            type: string;
            id: string;
        }[] = [];
        const completions = new Map<string, () => void>();
        const notify = (id: string) => {

            for (const window of BrowserWindow.getAllWindows()) {
                window.webContents.send("agent-sessions:changed", {
                    type: "updated",
                    id,
                });
            }
        };
        ipcMain.removeHandler("agent-sessions:command");
        ipcMain.handle("agent-sessions:command", (_event, request: {
            type: string;
            id?: string;
            text?: string;
        }) => {

            const session = sessions[request.id ?? selectedId]!;
            let value: unknown;
            switch (request.type) {
                case "list":
                    value = {
                        selectedId,
                        sessions: Object.values(sessions),
                    };
                    break;
                case "read":
                    value = session;
                    break;
                case "routes":
                    value = {
                        flagship: session.route,
                        reasoning: session.route,
                        action: session.route,
                    };
                    break;
                case "select":
                    selectedId = session.id;
                    notify(session.id);
                    break;
                case "prompt":
                    calls.push({
                        type: request.type,
                        id: session.id,
                    });

                    return new Promise(resolve => {

                        completions.set(session.id, () => {

                            session.status = "completed";
                            notify(session.id);
                            resolve({ ok: true });
                        });
                    });
                case "enqueue":
                    calls.push({
                        type: request.type,
                        id: session.id,
                    });
                    session.queuedPrompts.push({
                        id: "synthetic-supplement",
                        text: request.text!,
                    });
                    notify(session.id);
                    value = { id: "synthetic-supplement" };
                    break;
                case "cancelTurn":
                    calls.push({
                        type: request.type,
                        id: session.id,
                    });
                    completions.get(session.id)?.();
                    session.status = "idle";
                    session.queuedPrompts = [];
                    notify(session.id);
                    break;
                default:
                    throw new Error("Unexpected synthetic session command");
            }

            return {
                ok: true,
                value,
            };
        });

        return {
            calls,
            complete(id: string) {

                completions.get(id)?.();
            },
            running(id: string) {

                sessions[id]!.status = "running";
                notify(id);
            },
        };
    });
    await controller.reload();
    await controller.getByRole("button", {
        name: "Text input",
        exact: true,
    }).click();
    const input = controller.getByRole("textbox", { name: "Message your agent" });
    const status = controller.locator(".controller-task");
    const send = controller.getByRole("button", {
        name: "Send message",
        exact: true,
    });
    const select = async (id: string) => {

        await controller.getByRole("button", {
            name: "Sessions",
            exact: true,
        }).click();
        await controller.getByRole("button", { name: new RegExp(`synthetic-${id} ·`) }).click();
        await expect(controller.getByRole("button", { name: "Choose Agent, model and effort" })).toContainText(`synthetic-${id}`);
    };

    await input.fill("Synthetic request A");
    await input.press("End");
    await input.press("Shift+Enter");
    await expect(input).toHaveValue("Synthetic request A\n");
    await input.dispatchEvent("keydown", {
        key: "Enter",
        isComposing: true,
    });
    expect(await state.evaluate(value => {

        return value.calls.length;
    })).toBe(0);

    await input.press("Enter");
    await expect.poll(() => {

        return state.evaluate(value => {

            return value.calls.length;
        });
    }).toBe(1);
    await state.evaluate(value => {

        return void value.running("a");
    });
    await expect(controller.getByRole("button", { name: "Cancel task" })).toBeVisible();

    await select("b");
    await expect(status).toContainText("Ready for your next request");
    await input.fill("Synthetic request B");
    await send.click();
    await expect.poll(() => {

        return state.evaluate(value => {

            return value.calls;
        });
    }).toEqual([
        {
            type: "prompt",
            id: "a",
        },
        {
            type: "prompt",
            id: "b",
        },
    ]);
    await expect(input).toHaveValue("");
    await expect(status).toContainText("Sending request…");
    await input.fill("Synthetic duplicate before admission");
    await send.click();
    expect(await state.evaluate(value => {

        return value.calls.length;
    })).toBe(2);
    await expect(input).toHaveValue("Synthetic duplicate before admission");

    await state.evaluate(value => {

        return void value.complete("a");
    });
    await expect(status).toContainText("Sending request…");
    await controller.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("independent-pending.png"),
    });

    await select("a");
    await expect(status).toContainText("Task complete");
    await select("b");
    await state.evaluate(value => {

        return void value.running("b");
    });
    await expect(controller.getByRole("button", { name: "Cancel task" })).toBeVisible();
    await expect(input).toBeEditable();
    await input.fill("Synthetic supplement B");
    await input.press("Enter");
    await expect.poll(() => {

        return state.evaluate(value => {

            return value.calls.at(-1);
        });
    }).toEqual({
        type: "enqueue",
        id: "b",
    });
    await expect(controller.getByText("1 additional request(s) queued")).toBeVisible();
    await controller.getByRole("button", { name: "Cancel task" }).click();
    await expect.poll(() => {

        return state.evaluate(value => {

            return value.calls.at(-1);
        });
    }).toEqual({
        type: "cancelTurn",
        id: "b",
    });
    await expect(status).toContainText("Ready for your next request");
    await expect(controller.getByRole("button", { name: "Cancel task" })).toBeHidden();
});
