/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Integration
 * @description Deepseek Agent.test
 */

import { AgentPreferences } from "../../src/main/agent/agent-preferences";
import { DeepSeekAgentHost } from "../../src/main/agent/deepseek-agent-host";
import { AgentSessions } from "../../src/main/agent/sessions/agent-sessions";
import type { DashboardBlockRuntime } from "../../src/main/canvas/blocks/block-runtime";
import { CanvasService } from "../../src/main/canvas/canvas-service";
import { canvasToolDefinitions, invokeCanvasTool } from "../../src/main/canvas/canvas-tools";
import { captureIpcResult } from "../../src/main/ipc/ipc-result";
import type { WorkspaceFile } from "../../src/main/storage/workspace-file";
import { IpcErrorCode } from "@avesd/desktop-contracts/ipc-result";
import type { DashboardScope } from "@avesd/workspace-model";
import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

const answer = () => {

    return Response.json({
        choices: [
            {
                finish_reason: "stop",
                message: { content: "Done" },
            },
        ],
    });
};
const call = () => {

    return Response.json({
        choices: [
            {
                finish_reason: "tool_calls",
                message: {
                    content: null,
                    tool_calls: [
                        {
                            id: "call-1",
                            type: "function",
                            function: {
                                name: "aves_dashboard_canvases",
                                arguments: JSON.stringify({ request: { type: "list" } }),
                            },
                        },
                    ],
                },
            },
        ],
    });
};

async function errorSession(request: typeof fetch) {

    const sessions: AgentSessions = new AgentSessions(new AgentPreferences(), async () => {

        return {
            workspaceId: "synthetic-workspace" as DashboardScope["workspaceId"],
            dashboardId: "synthetic-canvas" as DashboardScope["dashboardId"],
            kind: "interactive",
            source: "test",
        };
    }, async (_origin, _route, id) => {

        return {
            host: new DeepSeekAgentHost({
                key: () => {

                    return "synthetic-key";
                },
                authorize: executionId => {

                    return sessions.authorizeExecution(id, executionId);
                },
                request,
                invoke: async () => {

                    throw new Error("No tools expected.");
                },
            }),
            release() {},
        };
    }, () => {
    });
    const { id } = await sessions.create();

    return {
        sessions,
        id,
    };
}

void test("history exhaustion retains its safe code and recovery guidance through session IPC", async () => {

    let requests = 0;
    const { sessions, id } = await errorSession(async () => {

        requests++;

        return answer();
    });
    try {
        for (let turn = 0; turn < 5; turn++) {
            await sessions.prompt("x".repeat(32000), id);
        }

        const exhausted = await captureIpcResult(() => {

            return sessions.prompt("x".repeat(32000), id);
        });
        const retried = await captureIpcResult(() => {

            return sessions.prompt("Synthetic short retry", id);
        });

        const expected = {
            ok: false,
            error: {
                code: IpcErrorCode.Busy,
                message: "Conversation limit reached. Start a new conversation.",
            },
        };
        assert.deepEqual(exhausted, expected);
        assert.deepEqual(retried, expected);
        assert.equal(requests, 5);
        const lastStatus = sessions.read(id).events.filter(({ event }) => {

            return event.type === "status";
        }).at(-1)?.event;
        assert.deepEqual(lastStatus, {
            type: "status",
            status: "error",
            message: expected.error.message,
        });

        const next = await sessions.create();
        await sessions.prompt("Synthetic new conversation", next.id);

        assert.equal(requests, 6);
        assert.equal(sessions.read(next.id).status, "completed");
    } finally {
        sessions.dispose();
    }
});

void test("unexpected DeepSeek failures remain sanitized and allow a later turn", async () => {

    let fail = true;
    const { sessions, id } = await errorSession(async () => {

        if (fail) {
            throw new Error("synthetic-private-provider-detail");
        }

        return answer();
    });
    try {
        const result = await captureIpcResult(() => {

            return sessions.prompt("Synthetic failure", id);
        });

        assert.deepEqual(result, {
            ok: false,
            error: {
                code: IpcErrorCode.Internal,
                message: "Agent task failed. Please try again.",
            },
        });
        assert.equal(JSON.stringify(sessions.read(id).events).includes("synthetic-private-provider-detail"), false);

        fail = false;
        await sessions.prompt("Synthetic recovery", id);

        assert.equal(sessions.read(id).status, "completed");
    } finally {
        sessions.dispose();
    }
});

void test("direct DeepSeek loop executes a real canvas tool and returns its result", async () => {

    const requests: Record<string, unknown>[] = [];
    let reads = 0;
    const file: Pick<WorkspaceFile, "readService" | "transaction"> = {
        async readService() {

            reads++;

            return {
                snapshot: undefined,
                metadata: {},
            };
        },
        async transaction() {

            throw new Error("No mutation expected");
        },
    };
    const service = new CanvasService(file);
    const host = new DeepSeekAgentHost({
        key: () => {

            return "synthetic-key";
        },
        authorize: () => {

            return () => {

                return true;
            };
        },
        tools: canvasToolDefinitions,
        request: async (_url, init) => {

            requests.push(JSON.parse(init!.body as string) as Record<string, unknown>);

            return requests.length === 1 ? call() : answer();
        },
        invoke: (name, input, isActive) => {

            return invokeCanvasTool(service, {
                clientId: "test",
                canvasIds: "all",
                isActive,
            }, async () => {

                throw new Error("No window expected");
            }, {} as DashboardBlockRuntime, name, input);
        },
    });
    try {
        await host.prompt("List canvases", "run-1");
        assert.equal(requests.length, 2);
        assert.equal(reads, 1);
        const messages = requests[1]!.messages as {
            role: string;
            tool_call_id?: string;
            content: string;
        }[];
        assert.equal(messages.at(-1)!.role, "tool");
        assert.equal(messages.at(-1)!.tool_call_id, "call-1");
        assert.match(messages.at(-1)!.content, /content/u);
        assert.equal(JSON.stringify(requests).includes("synthetic-key"), false);
    } finally {
        host.dispose();
    }
});

void test("DeepSeek cancellation retains conversation, rejects late tool responses, and drains supplements FIFO", { timeout: 5000 }, async () => {

    let release!: (response: Response) => void;
    const delayed = new Promise<Response>(resolve => {

        release = resolve;
    });
    const requests: {
        messages: {
            role: string;
            content: string;
        }[];
    }[] = [];
    let releaseSecond!: (response: Response) => void;
    const delayedSecond = new Promise<Response>(resolve => {

        releaseSecond = resolve;
    });
    let invoked = 0;
    let hostCount = 0;
    const sessions: AgentSessions = new AgentSessions(new AgentPreferences(), async () => {

        return {
            workspaceId: "test" as DashboardScope["workspaceId"],
            dashboardId: "test" as DashboardScope["dashboardId"],
            kind: "interactive",
            source: "test",
        };
    }, async (_origin, _route, id) => {

        hostCount++;

        return {
            host: new DeepSeekAgentHost({
                key: () => {

                    return "synthetic-key";
                },
                tools: canvasToolDefinitions,
                authorize: executionId => {

                    return sessions.authorizeExecution(id, executionId);
                },
                request: async (_url, init) => {

                    requests.push(JSON.parse(init!.body as string) as typeof requests[number]);

                    if (requests.length === 1) {
                        return delayed;
                    }
                    if (requests.length === 2) {
                        return delayedSecond;
                    }

                    return answer();
                },
                invoke: async () => {

                    invoked++;

                    return { content: [] };
                },
            }),
            release() {},
        };
    }, () => {
    });
    try {
        const { id } = await sessions.create();
        const first = sessions.prompt("first", id);
        while (!requests.length) {
            await setImmediate();
        }
        const oldId = sessions.read(id).execution!.id;
        const oldGate = sessions.authorizeExecution(id, oldId);
        sessions.enqueue("discard", id);
        const cancel = sessions.cancelTurn(id);
        assert.equal(oldGate(), false);
        release(call());
        await cancel;
        await first;
        assert.equal(invoked, 0);
        assert.equal(sessions.read(id).execution!.status, "cancelled");
        const second = sessions.prompt("second", id);
        while (requests.length < 2) {
            await setImmediate();
        }
        sessions.enqueue("third", id);
        sessions.enqueue("fourth", id);
        releaseSecond(answer());
        await second;
        while (sessions.read(id).status === "running" || requests.length < 4) {
            await setImmediate();
        }
        assert.equal(hostCount, 1);
        assert.equal(oldGate(), false);
        assert.equal(sessions.authorizeExecution(id, oldId)(), false);
        assert.equal(requests.length, 4);
        assert.match(requests[1]!.messages.find(m => {

            return m.role === "user";
        })!.content, /first/u);
        for (const [
            i,
            text,
        ] of [
                "second",
                "third",
                "fourth",
            ].entries()) {
            assert.match(requests[i + 1]!.messages.at(-1)!.content, new RegExp(text, "u"));
        }
        assert.equal(JSON.stringify(requests).includes("discard"), false);
    } finally {
        sessions.dispose();
    }
});

void test("cancelling during a tool fences its work and repairs pending tool messages before reuse", async () => {

    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => {

        release = resolve;
    });
    const started = new Promise<void>(resolve => {

        entered = resolve;
    });
    let authorized = true;
    let commits = 0;
    let invocations = 0;
    let requests = 0;
    let recovered: {
        role: string;
        tool_call_id?: string;
    }[] = [];
    const host = new DeepSeekAgentHost({
        key: () => {

            return "synthetic-key";
        },
        tools: canvasToolDefinitions,
        authorize: () => {

            const allowed = authorized;

            return () => {

                return allowed && authorized;
            };
        },
        request: async (_url, init) => {

            requests++;
            if (requests === 1) {
                return Response.json({
                    choices: [
                        {
                            finish_reason: "tool_calls",
                            message: {
                                tool_calls: [
                                    "one",
                                    "two",
                                ].map(id => {

                                    return {
                                        id,
                                        type: "function",
                                        function: {
                                            name: "aves_dashboard_canvases",
                                            arguments: '{"request":{"type":"list"}}',
                                        },
                                    };
                                }),
                            },
                        },
                    ],
                });
            }
            recovered = (JSON.parse(init!.body as string) as {
                messages: typeof recovered;
            }).messages;

            return answer();
        },
        invoke: async (_name, _input, active) => {

            invocations++;
            entered();
            await blocked;
            if (active()) {
                commits++;
            }

            return {
                content: [
                    {
                        type: "text",
                        text: "Synthetic result",
                    },
                ],
            };
        },
    });
    try {
        const pending = host.prompt("first", "first");
        await started;
        authorized = false;
        await host.cancel();
        release();
        await pending;
        assert.equal(commits, 0);
        assert.equal(invocations, 1);
        authorized = true;
        await host.prompt("next", "next");
        assert.deepEqual(recovered.filter(m => {

            return m.role === "tool";
        }).map(m => {

            return m.tool_call_id;
        }), [
            "one",
            "two",
        ]);
        assert.equal(requests, 2);
    } finally {
        release();
        host.dispose();
    }
});

void test("existing DeepSeek hosts resolve replacement and deletion before each new request", async () => {

    let key: string | undefined = "synthetic-first-key";
    const headers: string[] = [];
    const host = new DeepSeekAgentHost({
        key: () => {

            return key;
        },
        authorize: () => {

            return () => {

                return true;
            };
        },
        invoke: async () => {

            throw new Error("No tools expected.");
        },
        request: async (_url, init) => {

            headers.push(new Headers(init?.headers).get("Authorization") ?? "");

            return new Response(JSON.stringify({
                choices: [
                    {
                        finish_reason: "stop",
                        message: { content: "OK" },
                    },
                ],
            }));
        },
    });
    try {
        await host.prompt("First", "first");
        key = "synthetic-replaced-key";
        await host.prompt("Next", "next");
        key = undefined;
        await assert.rejects(host.prompt("Deleted", "deleted"), /not configured/);
        assert.deepEqual(headers, [
            "Bearer synthetic-first-key",
            "Bearer synthetic-replaced-key",
        ]);
    } finally {
        host.dispose();
    }
});
