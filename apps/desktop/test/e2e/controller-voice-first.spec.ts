/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Verify voice-first controls, text drafts and cancellation with isolated synthetic state
 */

import { expect, test } from "./desktop-fixture";

test("text input is opt-in and preserves its draft and keyboard focus", async ({ controller }, testInfo) => {

    const input = controller.getByRole("textbox", { name: "Message your agent" });
    const toggle = controller.getByRole("button", {
        name: "Text input",
        exact: true,
    });
    await expect(input).toBeHidden();
    await expect(controller.getByRole("button", { name: "Start voice" })).toBeDisabled();
    await expect(toggle).toBeEnabled();
    await controller.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("compact-idle.png"),
    });

    await toggle.focus();
    await controller.keyboard.press("Enter");

    await expect(input).toBeFocused();
    await input.fill("Synthetic draft for keyboard input");
    const conversation = controller.getByRole("tab", {
        name: "Conversation",
        exact: true,
    });
    const sessions = controller.getByRole("tab", {
        name: "Sessions",
        exact: true,
    });
    await conversation.focus();
    await controller.keyboard.press("End");
    await expect(sessions).toBeFocused();
    await controller.keyboard.press("Enter");
    await expect(sessions).toHaveAttribute("aria-selected", "true");
    await expect(input).toBeHidden();
    await controller.keyboard.press("Home");
    await expect(conversation).toBeFocused();
    await controller.keyboard.press("Enter");
    await expect(input).toHaveValue("Synthetic draft for keyboard input");
    await expect(input).toBeFocused();
    await controller.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("voice-first-text.png"),
    });
    await controller.getByRole("button", { name: "Hide text input" }).click();

    await expect(input).toBeHidden();
    await expect(toggle).toBeFocused();
    await controller.keyboard.press("Tab");
    await expect(controller.getByRole("textbox", {
        name: "Message your agent",
        includeHidden: true,
    })).not.toBeFocused();
    await toggle.click();

    await expect(input).toHaveValue("Synthetic draft for keyboard input");
    await expect(input).toBeFocused();
});

for (const waiting of [
    false,
    true,
]) {
    test(`details preserve connected voice and cancellation survives voice ending (waiting=${waiting})`, async ({ controller, desktop }, testInfo) => {

        // Substitute service responses only; the real renderer, preload and native window remain in use.
        await desktop.evaluate(({ ipcMain }, waitingForAnswer) => {

            const route = { providerId: "synthetic-provider" };
            const session = {
                id: "synthetic-session",
                kind: "interactive",
                tier: "flagship",
                source: "synthetic",
                createdAt: 0,
                status: waitingForAnswer ? "completed" : "running",
                waitingForAnswer,
                route,
                queuedPrompts: [],
                events: [
                    {
                        sequence: 1,
                        event: {
                            type: "messageChunk",
                            text: "Synthetic task feedback remains available in the conversation.",
                        },
                    },
                ],
            };
            ipcMain.removeHandler("agent-sessions:command");
            ipcMain.handle("agent-sessions:command", (event, request: {
                type: string;
                id?: string;
            }) => {

                let value: unknown;
                switch (request.type) {
                    case "list":
                        value = {
                            selectedId: session.id,
                            sessions: [session],
                        };
                        break;
                    case "read":
                        value = session;
                        break;
                    case "routes":
                        value = {
                            flagship: route,
                            reasoning: route,
                            action: route,
                        };
                        break;
                    case "create":
                        session.id = "synthetic-next-session";
                        event.sender.send("agent-sessions:changed", {
                            type: "selectionChanged",
                            id: session.id,
                        });
                        value = { id: session.id };
                        break;
                    case "cancelTurn":
                        if (request.id !== session.id) {
                            throw new Error("Unexpected cancellation target");
                        }
                        session.status = "idle";
                        session.waitingForAnswer = false;
                        event.sender.send("agent-sessions:changed", {
                            type: "updated",
                            id: session.id,
                        });
                        break;
                    default:
                        throw new Error("Unexpected synthetic session command");
                }

                return {
                    ok: true,
                    value,
                };
            });
            ipcMain.removeHandler("live:command");
            ipcMain.handle("live:command", (_event, request: {
                type: string;
            }) => {

                if (request.type === "availability") {
                    return {
                        ok: true,
                        value: { configured: true },
                    };
                }
                if (request.type === "start") {
                    return {
                        ok: true,
                        value: { sdp: "synthetic-answer" },
                    };
                }
                if (request.type === "stop" || request.type === "event") {
                    return { ok: true };
                }
                throw new Error("Synthetic voice must never reach the provider");
            });
        }, waiting);
        await controller.reload();
        // Synthetic media and WebRTC exercise renderer lifecycle without recording or a provider.
        const mediaRequests = await controller.evaluateHandle(() => {

            const counter = {
                count: 0,
                stopped: 0,
                peers: 0,
                disconnect: () => {
                },
            };
            const track = {
                enabled: true,
                onended: null,
                stop: () => {

                    counter.stopped += 1;
                },
            };
            // This callback runs in Chromium; the test runner uses Node-only TypeScript libs.
            const mediaNavigator = navigator as unknown as {
                readonly mediaDevices: object;
            };
            Object.defineProperty(mediaNavigator.mediaDevices, "getUserMedia", {
                value: async () => {

                    counter.count += 1;

                    return {
                        getTracks: () => {

                            return [track];
                        },
                        getAudioTracks: () => {

                            return [track];
                        },
                    };
                },
            });
            class SyntheticPeer {
                iceGatheringState = "complete";
                connectionState = "connected";
                localDescription = { sdp: "synthetic-offer" };
                onconnectionstatechange?: () => void;
                channel = {
                    readyState: "open",
                    onmessage: undefined as ((event: {
                        data: string;
                    }) => void) | undefined,
                    send: (data: string) => {

                        if (JSON.parse(data).type === "session.close") {
                            queueMicrotask(() => {

                                this.channel.onmessage?.({ data: JSON.stringify({ type: "session.closed" }) });
                            });
                        }
                    },
                    close: () => {
                    },
                };
                constructor() {

                    counter.peers += 1;
                    counter.disconnect = () => {

                        this.connectionState = "disconnected";
                        this.onconnectionstatechange?.();
                    };
                }
                addTrack() {}
                createDataChannel() {

                    return this.channel;
                }
                async createOffer() {

                    return this.localDescription;
                }
                async setLocalDescription() {}
                async setRemoteDescription() {

                    this.channel.onmessage?.({ data: JSON.stringify({ type: "session.started" }) });
                }
                close() {}
            }
            Object.defineProperty(globalThis, "RTCPeerConnection", { value: SyntheticPeer });

            return counter;
        });
        await expect(controller.getByRole("button", { name: "Cancel task" })).toBeVisible();
        await controller.getByRole("button", { name: "Start voice" }).click();

        await expect(controller.getByText("Listening · GPT-Live 1", { exact: true })).toBeVisible();
        await controller.getByRole("button", {
            name: "Text input",
            exact: true,
        }).click();
        await controller.getByRole("textbox").fill("Synthetic pending draft");
        await controller.getByRole("button", { name: "Hide text input" }).click();

        await expect(controller.getByText("Listening · GPT-Live 1", { exact: true })).toBeVisible();
        await controller.getByRole("tab", {
            name: "Sessions",
            exact: true,
        }).click();
        await expect(controller.getByText("Listening · GPT-Live 1", { exact: true })).toBeVisible();
        await controller.getByRole("tab", {
            name: "Conversation",
            exact: true,
        }).click();
        await expect(controller.getByText("Synthetic task feedback remains available in the conversation.")).toBeVisible();
        await controller.screenshot({
            animations: "disabled",
            path: testInfo.outputPath("expanded-connected.png"),
        });
        await controller.getByRole("button", {
            name: "Collapse controller",
            exact: true,
        }).click();

        await expect(controller.getByRole("tablist", { name: "Controller panels" })).toBeHidden();
        await expect(controller.getByText("Listening · GPT-Live 1", { exact: true })).toBeVisible();
        expect(await mediaRequests.evaluate(value => {

            return {
                count: value.count,
                stopped: value.stopped,
                peers: value.peers,
            };
        })).toEqual({
            count: 1,
            stopped: 0,
            peers: 1,
        });
        await controller.getByRole("button", {
            name: "Mute microphone",
            exact: true,
        }).click();
        await expect(controller.getByText("Microphone muted · still connected", { exact: true })).toBeVisible();
        await controller.getByRole("button", {
            name: "Unmute microphone",
            exact: true,
        }).click();
        await controller.screenshot({
            animations: "disabled",
            path: testInfo.outputPath("compact-connected.png"),
        });
        if (waiting) {
            const narrowWindow = await desktop.browserWindow(controller);
            await narrowWindow.evaluate(window => {

                window.setBounds({
                    width: 320,
                    height: 240,
                });
            });
            await expect(controller.getByRole("button", { name: "End voice" })).toBeInViewport();
            await expect(controller.getByRole("button", { name: "Cancel task" })).toBeInViewport();
            await controller.screenshot({
                animations: "disabled",
                path: testInfo.outputPath("compact-narrow.png"),
            });
        }
        await controller.getByRole("button", {
            name: "Open controller",
            exact: true,
        }).click();
        const nativeWindow = await desktop.browserWindow(controller);
        await nativeWindow.evaluate(window => {

            window.close();
        });
        await expect(controller.getByRole("tablist", { name: "Controller panels" })).toBeHidden();
        await expect(controller.getByText("Listening · GPT-Live 1", { exact: true })).toBeVisible();

        if (waiting) {
            await mediaRequests.evaluate(value => {

                value.disconnect();
            });
            await expect(controller.getByText("Voice connection lost. Agent work can still continue.", { exact: true })).toBeVisible();
            await controller.screenshot({
                animations: "disabled",
                path: testInfo.outputPath("compact-disconnected.png"),
            });
        } else {
            await controller.getByRole("button", { name: "End voice" }).click();
            await expect(controller.getByText("Voice ended. Agent work is unchanged.", { exact: true })).toBeVisible();
        }
        expect(await mediaRequests.evaluate(value => {

            return value.stopped;
        })).toBe(1);
        await expect(controller.getByRole("button", { name: "Cancel task" })).toBeEnabled();
        await controller.getByRole("button", { name: "Cancel task" }).click();

        await expect(controller.getByRole("button", { name: "Cancel task" })).toBeHidden();
        await controller.getByRole("button", {
            name: "Text input",
            exact: true,
        }).click();
        await expect(controller.getByRole("textbox")).toHaveValue("Synthetic pending draft");
        await controller.getByRole("button", { name: "Start voice" }).click();
        await expect(controller.getByText("Listening · GPT-Live 1", { exact: true })).toBeVisible();
        await controller.getByRole("button", {
            name: "New conversation",
            exact: true,
        }).click();
        await expect(controller.getByText("Voice ended. Agent work is unchanged.", { exact: true })).toBeVisible();
        expect(await mediaRequests.evaluate(value => {

            return value.stopped;
        })).toBe(2);
    });
}
