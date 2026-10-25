/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Agent_Sessions
 * @description Agent Sessions.test
 */

import { AgentPreferences } from "../../../../../src/main/agent/agent-preferences";
import { AgentSessions } from "../../../../../src/main/agent/sessions/agent-sessions";
import { captureIpcResult } from "../../../../../src/main/ipc/ipc-result";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { AgentEvent, AgentSettings } from "@avesd/plugin-api";
import type { DashboardScope } from "@avesd/workspace-model";
import assert from "node:assert/strict";
import { test } from "node:test";
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
async function setup(timeout = 25) {

    const hosts: Host[] = [];
    const sessions = new AgentSessions(new AgentPreferences(), async () => {

        return {
            workspaceId: "test-workspace" as DashboardScope["workspaceId"],
            dashboardId: "test-canvas" as DashboardScope["dashboardId"],
            kind: "interactive",
            source: "test",
        };
    }, async () => {

        const host = new Host();
        hosts.push(host);

        return {
            host,
            release() {},
        };
    }, () => {
    }, timeout);
    const { id } = await sessions.create();
    await sessions.connect(id);

    return {
        sessions,
        id,
        hosts,
        host: hosts[0]!,
    };
}
async function tick() {

    await setImmediate();
}

void test("cancel one turn, revoke its authorization immediately, and reuse the Agent connection", async () => {

    const { sessions, id, host, hosts } = await setup();
    try {
        const first = sessions.prompt("first", id);
        await tick();
        const executionId = sessions.read(id).execution!.id;
        const active = sessions.authorizeExecution(id, executionId);
        assert.equal(active(), true);
        sessions.enqueue("discard this supplement", id);
        const cancelling = sessions.cancelTurn(id);
        assert.equal(active(), false);
        await cancelling;
        await first;
        assert.equal(sessions.read(id).execution!.status, "cancelled");
        assert.equal(sessions.read(id).status, "idle");
        assert.deepEqual(sessions.read(id).queuedPrompts, []);
        assert.equal(host.disposed, false);
        const second = sessions.prompt("next", id);
        await tick();
        assert.equal(hosts.length, 1);
        assert.equal(sessions.authorizeExecution(id, executionId)(), false);
        assert.equal(active(), false);
        assert.equal(sessions.authorizeExecution(id, sessions.read(id).execution!.id)(), true);
        host.requests[1]!.done.resolve();
        await second;
    } finally {
        sessions.dispose();
    }
});

void test("task results settle before queued turns and retain only their own reply", async () => {

    const { sessions, id, host } = await setup();
    try {
        const task = sessions.startTask("Synthetic block task", id);
        assert.deepEqual(task.snapshot(), {
            status: "running",
            answer: "",
        });
        await tick();

        for (const listener of host.listeners) {
            listener({
                type: "messageChunk",
                text: "Original task answer",
            });
        }
        sessions.enqueue("Synthetic queued turn", id);
        host.requests[0]!.done.resolve();
        await tick();

        const settled = task.snapshot();
        assert.deepEqual(settled, {
            status: "completed",
            answer: "Original task answer",
        });
        assert.equal(host.requests.length, 2);
        assert.equal(sessions.read(id).execution?.status, "running");

        for (const listener of host.listeners) {
            listener({
                type: "messageChunk",
                text: "Later conversation answer",
            });
        }
        host.requests[1]!.done.resolve();
        await tick();
        await sessions.remove(id);

        assert.deepEqual(task.snapshot(), settled);
    } finally {
        sessions.dispose();
    }
});

void test("task handles retain failures before execution admission and during preparation", async () => {

    const { sessions, id, host } = await setup();
    try {
        const running = sessions.prompt("Existing turn", id);
        await tick();

        const rejected = sessions.startTask("Cannot overlap", id);
        await tick();

        assert.equal(rejected.snapshot().status, "error");
        assert.equal(host.requests.length, 1);

        host.requests[0]!.done.resolve();
        await running;
        await sessions.remove(id);
    } finally {
        sessions.dispose();
    }

    const unavailable = new AgentSessions(new AgentPreferences(), async () => {

        throw new Error("No implicit task origin expected.");
    }, async () => {

        throw new OperationError(IpcErrorCode.ServiceNotReady, "Synthetic unavailable Agent.");
    }, () => {
    });
    try {
        const created = await unavailable.create("reasoning", {
            workspaceId: "test-workspace" as DashboardScope["workspaceId"],
            dashboardId: "test-canvas" as DashboardScope["dashboardId"],
            kind: "interactive",
            source: "test",
        });

        const task = unavailable.startTask("Cannot prepare", created.id);
        await tick();

        assert.deepEqual(task.snapshot(), {
            status: "error",
            answer: "",
        });
    } finally {
        unavailable.dispose();
    }
});

void test("supplements execute FIFO once each, with distinct execution IDs", async () => {

    const { sessions, id, host } = await setup();
    try {
        const first = sessions.prompt("first", id);
        await tick();
        const runId = sessions.read(id).execution!.id;
        sessions.enqueue("second", id);
        sessions.enqueue("third", id);
        assert.equal(host.requests.length, 1);
        host.requests[0]!.done.resolve();
        await first;
        await tick();
        assert.match(host.requests[1]!.text, /second$/);
        assert.notEqual(sessions.read(id).execution!.id, runId);
        host.requests[1]!.done.resolve();
        await tick();
        assert.match(host.requests[2]!.text, /third$/);
        host.requests[2]!.done.resolve();
        await tick();
        assert.equal(host.requests.length, 3);
        assert.equal(sessions.read(id).status, "completed");
        assert.equal(sessions.authorizeExecution(id, sessions.read(id).execution!.id)(), false);
    } finally {
        sessions.dispose();
    }
});

void test("cancellation timeout releases the old connection and late events cannot overwrite a new run", async () => {

    const { sessions, id, host, hosts } = await setup();
    try {
        host.ignoreCancel = true;
        const first = sessions.prompt("first", id);
        await tick();
        await sessions.cancelTurn(id);
        await first;
        assert.equal(host.disposed, true);
        assert.equal(sessions.read(id).connectionReset, true);
        const second = sessions.prompt("second", id);
        await tick();
        const execution = sessions.read(id).execution;
        host.requests[0]!.done.resolve();
        for (const listener of host.listeners) {
            listener({
                type: "status",
                status: "error",
                message: "old failure",
            });
        }
        await tick();
        assert.deepEqual(sessions.read(id).execution, execution);
        assert.equal(sessions.read(id).status, "running");
        hosts[1]!.requests[0]!.done.resolve();
        await second;
    } finally {
        sessions.dispose();
    }
});

void test("cancellation during preparation never sends the cancelled prompt", async () => {

    const { sessions, id, host } = await setup();
    try {
        for (const listener of host.listeners) {
            listener({
                type: "status",
                status: "disconnected",
            });
        }
        host.connection = deferred();
        const first = sessions.prompt("must not run", id);
        await tick();
        await sessions.cancelTurn(id);
        await first;
        host.connection.resolve();
        await tick();
        assert.equal(host.requests.length, 0);
        assert.equal(sessions.read(id).execution!.status, "cancelled");
    } finally {
        sessions.dispose();
    }
});

void test("queue is bounded and permanent cancellation remains permanent", async () => {

    const { sessions, id, host } = await setup();
    const first = sessions.prompt("first", id);
    await tick();
    for (let index = 0; index < 16; index++) {
        sessions.enqueue(`extra ${index}`, id);
    }
    assert.throws(() => {

        return sessions.enqueue("overflow", id);
    });
    await sessions.cancel(id);
    await first;
    assert.equal(host.disposed, true);
    assert.equal(sessions.read(id).status, "stopped");
    await assert.rejects(sessions.prompt("cannot resume", id));
    sessions.dispose();
});

void test("cancelling while a canvas answer is being checked prevents its continuation", async () => {

    const { sessions, id, host } = await setup();
    try {
        const first = sessions.prompt("ask a question", id);
        await tick();
        const owner = sessions.questionOwner(id)!;
        sessions.waitForAnswer(owner, "question", true);
        host.requests[0]!.done.resolve();
        await first;
        const check = deferred();
        sessions.respond(owner, "answer", "answer text", async () => {

            await check.promise;

            return true;
        });
        await sessions.cancelTurn(id);
        const second = sessions.prompt("new request", id);
        await tick();
        check.resolve();
        await tick();
        assert.equal(host.requests.length, 2);
        assert.equal(sessions.continuationStatus(owner, "answer"), "unavailable");
        host.requests[1]!.done.resolve();
        await second;
    } finally {
        sessions.dispose();
    }
});

void test("supplements wait for the question answer and resume after its continuation", async () => {

    const { sessions, id, host } = await setup();
    try {
        const first = sessions.prompt("ask a question", id);
        await tick();
        const owner = sessions.questionOwner(id)!;
        sessions.waitForAnswer(owner, "question", true);
        sessions.enqueue("supplement", id);
        host.requests[0]!.done.resolve();
        await first;
        await tick();
        assert.equal(host.requests.length, 1);
        sessions.respond(owner, "answer", "answer text", async () => {

            return true;
        });
        await tick();
        assert.match(host.requests[1]!.text, /answer text$/);
        host.requests[1]!.done.resolve();
        await tick();
        assert.match(host.requests[2]!.text, /supplement$/);
        host.requests[2]!.done.resolve();
        await tick();
        assert.equal(sessions.read(id).status, "completed");
    } finally {
        sessions.dispose();
    }
});

void test("concurrency rejection retains its Busy code through the IPC boundary", async () => {

    const { sessions, id, hosts } = await setup();
    const prompts: Promise<void>[] = [];
    try {
        for (let index = 0; index < 8; index++) {
            const sessionId = index === 0 ? id : (await sessions.create()).id;
            prompts.push(sessions.prompt("synthetic request", sessionId));
        }
        await tick();
        const extra = await sessions.create();
        const result = await captureIpcResult(() => {

            return sessions.prompt("over capacity", extra.id);
        });
        assert.equal(result.ok, false);
        assert.equal(result.error.code, IpcErrorCode.Busy);
        assert.match(result.error.message, /eight/);
        assert.equal(hosts.length, 8);
        assert.equal(sessions.read(extra.id).status, "error");
    } finally {
        sessions.dispose();
        await Promise.all(prompts);
    }
});

void test("prompt errors preserve safe operational details and sanitize unexpected failures", async () => {

    const { sessions, id, host } = await setup();
    try {
        const expected = new OperationError(IpcErrorCode.VersionConflict, "Synthetic revision conflict.", 7);
        host.prompt = async () => {

            throw expected;
        };
        await assert.rejects(sessions.prompt("synthetic request", id), expected);
        host.prompt = async () => {

            throw new Error("synthetic-private-detail");
        };
        const result = await captureIpcResult(() => {

            return sessions.prompt("synthetic retry", id);
        });
        assert.deepEqual(result, {
            ok: false,
            error: {
                code: IpcErrorCode.Internal,
                message: "Agent task failed. Please try again.",
            },
        });
        assert.equal(JSON.stringify(sessions.read(id).events).includes("synthetic-private-detail"), false);
    } finally {
        sessions.dispose();
    }
});

void test("failed preparation can retry and configuration waits for the connection", async () => {

    const { sessions, id, host } = await setup();
    try {
        for (const listener of host.listeners) {
            listener({
                type: "status",
                status: "disconnected",
            });
        }
        host.connect = async () => {

            throw new OperationError(IpcErrorCode.ServiceNotReady, "Synthetic connection failure.");
        };
        await assert.rejects(sessions.connect(id), { code: IpcErrorCode.ServiceNotReady });
        const connection = deferred();
        host.connect = async () => {

            await connection.promise;
        };
        const connecting = sessions.connect(id);
        await tick();
        const route = sessions.read(id).route;
        await assert.rejects(sessions.configureSession(id, route), { code: IpcErrorCode.Busy });
        connection.resolve();
        await connecting;
        await sessions.configureSession(id, route);
    } finally {
        sessions.dispose();
    }
});
