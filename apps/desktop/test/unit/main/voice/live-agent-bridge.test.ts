/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Voice
 * @description Live Agent Bridge.test
 */

import { AgentPreferences } from "../../../../src/main/agent/agent-preferences";
import { AgentSessions } from "../../../../src/main/agent/agent-sessions";
import { LiveAgentBridge } from "../../../../src/main/voice/live-agent-bridge";
import { LiveVoice } from "../../../../src/main/voice/live-voice";
import type { LiveCommand } from "../../../../src/shared/voice/live";
import type { AgentEvent, AgentSettings } from "@avesd/plugin-api";
import type { DashboardScope } from "@avesd/workspace-model";
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { setImmediate } from "node:timers/promises";

function deferred() {

    let resolve!: () => void;
    const promise = new Promise<void>(done => {

        resolve = done;
    });

    return {
        promise,
        resolve,
    };
}
class Host {
    requests: {
        text: string;
        done: ReturnType<typeof deferred>;
    }[] = [];
    listeners: ((event: AgentEvent) => void)[] = [];
    disposed = false;
    ignoreCancel = false;
    connection = deferred();
    constructor() {

        this.connection.resolve();
    }
    async connect() {

        await this.connection.promise;
    }
    async prompt(text: string) {

        const done = deferred();
        this.requests.push({
            text,
            done,
        });
        await done.promise;
    }
    async continuePrompt(text: string, _connectionId: string) {

        await this.prompt(text);
    }
    continuationToken() {

        return "connection";
    }
    async cancel() {

        if (!this.ignoreCancel) {
            this.requests.at(-1)?.done.resolve();
        }
    }
    async getSettings(): Promise<AgentSettings> {

        return {
            status: "connected",
            providerId: "codex",
            providers: [],
            agentName: "test",
            models: [],
        };
    }
    async selectProvider(_id: string) {}
    async selectModel(_id: string) {}
    async selectEffort(_id: string) {}
    publishSettings() {}
    subscribe(listener: (event: AgentEvent) => void) {

        this.listeners.push(listener);

        return () => {
        };
    }
    dispose() {

        this.disposed = true;
    }
}

async function setup() {

    const host = new Host();
    const output: LiveCommand[] = [];
    let observe = () => {
    };
    const sessions = new AgentSessions(new AgentPreferences(), async () => {

        return {
            workspaceId: "fixture" as DashboardScope["workspaceId"],
            dashboardId: "fixture" as DashboardScope["dashboardId"],
            kind: "interactive",
            source: "test",
        };
    }, async () => {

        return {
            host,
            release() {},
        };
    }, () => {

        return void observe();
    }, 50);
    const { id } = await sessions.create();
    await sessions.connect(id);
    const bridge = new LiveAgentBridge(id, sessions, event => {

        return output.push(event);
    });

    observe = () => {

        bridge.observe();
    };

    return {
        host,
        sessions,
        id,
        bridge,
        output,
    };
}
async function delegate(bridge: LiveAgentBridge, id: string, text: string, offset: number) {

    bridge.receive({
        type: "session.input_transcript.delta",
        delta: text,
        start_ms: offset - 10,
        end_ms: offset,
    });
    bridge.receive({
        type: "session.delegation.created",
        delegation: {
            id,
            target: "client",
        },
        offset_ms: offset,
    });
    await delay(800);
}
void test("voice delegation reuses execution authorization, queues additions, and reports each result once", async () => {

    const { host, sessions, id, bridge, output } = await setup();
    try {
        await delegate(bridge, "one", "Create a synthetic dashboard.", 100);
        assert.equal(host.requests.length, 1);
        const execution = sessions.read(id).execution!.id;
        assert.equal(sessions.authorizeExecution(id, execution)(), true);
        bridge.receive({
            type: "session.delegation.created",
            delegation: {
                id: "one",
                target: "client",
            },
            offset_ms: 100,
        });
        await delegate(bridge, "two", "Also add a synthetic note.", 200);
        assert.equal(host.requests.length, 1);
        assert.equal(sessions.read(id).queuedPrompts.length, 1);
        host.listeners.forEach(listener => {

            return void listener({
                type: "messageChunk",
                text: "Dashboard created.",
            });
        });
        host.requests[0]!.done.resolve();
        await setImmediate();
        await setImmediate();
        assert.equal(host.requests.length, 2);
        assert.equal(sessions.authorizeExecution(id, execution)(), false);
        host.listeners.forEach(listener => {

            return void listener({
                type: "messageChunk",
                text: "Note added.",
            });
        });
        host.requests[1]!.done.resolve();
        await setImmediate();
        assert.deepEqual(output.filter(item => {

            return item.type === "session.commentary.append";
        }).map(item => {

            return item.delegation_id;
        }), [
            "one",
            "two",
        ]);
    } finally {
        bridge.close();
        sessions.dispose();
    }
});
void test("cancel revokes a voice run, discards pending additions and late output, then allows conversation reuse", async () => {

    const { host, sessions, id, bridge, output } = await setup();
    try {
        await delegate(bridge, "one", "Create a synthetic dashboard.", 100);
        const gate = sessions.authorizeExecution(id, sessions.read(id).execution!.id);
        await delegate(bridge, "two", "Add a note.", 200);
        await bridge.cancelTask();
        assert.equal(gate(), false);
        assert.equal(sessions.read(id).queuedPrompts.length, 0);
        host.listeners.forEach(listener => {

            return void listener({
                type: "messageChunk",
                text: "Late result must not be spoken.",
            });
        });
        assert.equal(output.some(item => {

            return item.content.includes("Late result");
        }), false);
        await delegate(bridge, "three", "Now list dashboards.", 300);
        assert.equal(host.requests.length, 2);
        host.requests[1]!.done.resolve();
        await setImmediate();
        assert.equal(host.disposed, false);
    } finally {
        bridge.close();
        sessions.dispose();
    }
});
void test("transcripts alone never launch or cancel work; late transcript and duplicate delegation are handled", async () => {

    const { host, sessions, bridge } = await setup();
    try {
        bridge.receive({
            type: "session.input_transcript.delta",
            delta: "Wait",
            start_ms: 0,
            end_ms: 10,
        });
        await delay(800);
        assert.equal(host.requests.length, 0);
        bridge.receive({
            type: "session.delegation.created",
            delegation: {
                id: "one",
                target: "client",
            },
            offset_ms: 100,
        });
        bridge.receive({
            type: "session.input_transcript.delta",
            delta: ", create a synthetic dashboard.",
            start_ms: 10,
            end_ms: 100,
        });
        await delay(800);
        assert.equal(host.requests.length, 1);
        await bridge.cancelTask();
        await delegate(bridge, "two", "Do not cancel the task; list dashboards.", 200);
        assert.equal(host.requests.length, 2);
    } finally {
        bridge.close();
        sessions.dispose();
    }
});
void test("ending voice leaves Agent work running and suppresses result delivery", async () => {

    const { host, sessions, id, bridge, output } = await setup();
    try {
        await delegate(bridge, "one", "Create a synthetic dashboard.", 100);
        bridge.close();
        assert.equal(sessions.read(id).status, "running");
        host.listeners.forEach(listener => {

            return void listener({
                type: "messageChunk",
                text: "Done.",
            });
        });
        host.requests[0]!.done.resolve();
        await setImmediate();
        assert.equal(output.some(item => {

            return item.type === "session.commentary.append";
        }), false);
    } finally {
        sessions.dispose();
    }
});
void test("Live session creation keeps credentials in backend, fixes delegation mode, and rejects stale connection events", async () => {

    const { sessions, id, host } = await setup();
    let calls = 0;
    const voice = new LiveVoice(sessions, () => {
    }, () => {

        return "synthetic-key";
    }, async (url, init) => {

        calls++;
        assert.equal(url, "https://api.openai.com/v1/live/sessions");
        assert.equal(typeof init?.body, "string");
        const body = JSON.parse(init?.body as string) as {
            session: {
                model: string;
                delegation: {
                    type: string;
                };
            };
        };
        assert.equal(body.session.model, "gpt-live-1");
        assert.equal(body.session.delegation.type, "client");

        return new Response(JSON.stringify({
            session: { id: "synthetic-live" },
            transport: {
                type: "webrtc",
                sdp: "synthetic-answer",
            },
        }));
    });
    try {
        assert.deepEqual(await voice.start("connection", id, "synthetic-offer"), { sdp: "synthetic-answer" });
        await assert.rejects(voice.start("another", id, "offer"));
        assert.equal(calls, 1);
        voice.event("old", { type: "session.started" });
        voice.event("old", {
            type: "session.delegation.created",
            delegation: {
                id: "stale",
                target: "client",
            },
            offset_ms: 100,
        });
        await delay(800);
        assert.equal(host.requests.length, 0);
        await assert.rejects(voice.cancelTask("old"));
        voice.stop("old");
        await assert.rejects(voice.start("another", id, "offer"));
    } finally {
        voice.stop();
        sessions.dispose();
    }
});

void test("an explicit delegated cancellation stops only the current turn", async () => {

    const { host, sessions, id, bridge, output } = await setup();
    try {
        await delegate(bridge, "one", "Create a synthetic dashboard.", 100);
        await delegate(bridge, "cancel", "cancel current task", 200);
        assert.equal(sessions.read(id).execution?.status, "cancelled");
        assert.equal(host.disposed, false);
        assert.equal(output.some(item => {

            return item.delegation_id === "cancel" && item.content.includes("stopped");
        }), true);
        await delegate(bridge, "next", "List dashboards.", 300);
        assert.equal(host.requests.length, 2);
    } finally {
        bridge.close();
        sessions.dispose();
    }
});
void test("missing credentials fail before network access and provider errors do not expose payloads", async () => {

    const { sessions, id } = await setup();
    const unavailable = new LiveVoice(sessions, () => {
    }, () => {

        return undefined;
    }, async () => {

        throw new Error("Network must not be called");
    });
    const denied = new LiveVoice(sessions, () => {
    }, () => {

        return "synthetic-key";
    }, async () => {

        return new Response("synthetic-private-provider-details", { status: 403 });
    });
    try {
        assert.equal(unavailable.availability().configured, false);
        await assert.rejects(unavailable.start("one", id, "offer"), /OPENAI_API_KEY/);
        await assert.rejects(denied.start("two", id, "offer"), error => {

            assert.ok(error instanceof Error);
            assert.match(error.message, /HTTP 403/);
            assert.equal(error.message.includes("synthetic-private"), false);

            return true;
        });
    } finally {
        unavailable.stop();
        denied.stop();
        sessions.dispose();
    }
});
