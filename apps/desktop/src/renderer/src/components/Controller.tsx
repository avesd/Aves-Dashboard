import type { AgentSessionSnapshot, AgentSessionSummary, AgentTierRoute } from "../../../shared/agent/sessions";
import type { CanvasSummary } from "../../../shared/canvas/contracts";
import type { TranscriptEntry } from "./agent-transcript";
import { appendAgentEvent } from "./agent-transcript";
import { AgentMarkdown } from "./AgentMarkdown";
import { AgentRuntimePicker } from "./AgentRuntimePicker";
import { AgentProviderSettings } from "./settings/AgentProviderSettings";
import { AgentTierSettings } from "./settings/AgentTierSettings";
import { ArrowUp, ChevronDown, Layers, MessageCircle, Plus, Settings2, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Controller({ expanded }: {
    readonly expanded: boolean;
}) {

    const [
        panel,
        setPanel,
    ] = useState<"chat" | "canvases" | "settings" | "sessions">("chat");
    const [
        canvases,
        setCanvases,
    ] = useState<readonly CanvasSummary[]>([]);
    const [
        sessions,
        setSessions,
    ] = useState<readonly AgentSessionSummary[]>([]);
    const [
        session,
        setSession,
    ] = useState<AgentSessionSnapshot | null>(null);
    const [
        draft,
        setDraft,
    ] = useState("");
    const [
        error,
        setError,
    ] = useState<string>();
    const [
        sending,
        setSending,
    ] = useState(false);
    const [
        changingAgent,
        setChangingAgent,
    ] = useState(false);
    const composer = useRef<HTMLTextAreaElement>(null);
    const conversation = useRef<HTMLDivElement>(null);
    const follow = useRef(true);
    const busy = sending || session?.status === "running";
    const fail = (cause: unknown) => {

        setError(cause instanceof Error ? cause.message : "Operation failed.");
    };
    useEffect(() => {

        let active = true;
        let generation = 0;
        const refresh = async () => {

            const current = ++generation;
            try {
                const listing = await window.avesd.agentSessions.list();
                const selected = listing.selectedId ? await window.avesd.agentSessions.read(listing.selectedId) : null;
                if (active && current === generation) {
                    setSessions(listing.sessions); setSession(selected);
                }
            } catch (cause) {
                if (active) {
                    fail(cause);
                }
            }
        };
        const dispose = window.avesd.agentSessions.subscribe(() => {

            void refresh();
        });
        void refresh();

        return () => {

            active = false; dispose();
        };
    }, []);
    useEffect(() => {

        let active = true;
        let generation = 0;
        const refresh = async () => {

            const current = ++generation;
            try {
                const items: CanvasSummary[] = [];
                let cursor: string | undefined;
                do {
                    const page = await window.avesd.canvases.list({
                        limit: 100,
                        ...(cursor ? { cursor } : {}),
                    });
                    items.push(...page.canvases); cursor = page.nextCursor;
                } while (cursor && active && current === generation);
                if (active && current === generation) {
                    setCanvases(items);
                }
            } catch (cause) {
                if (active) {
                    fail(cause);
                }
            }
        };
        const dispose = window.avesd.canvases.subscribe(() => {

            void refresh();
        });
        void refresh();

        return () => {

            active = false; dispose();
        };
    }, []);
    useEffect(() => {

        if (expanded && panel === "chat") {
            composer.current?.focus();
        }
    }, [
        expanded,
        panel,
    ]);
    useEffect(() => {

        if (follow.current && conversation.current) {
            conversation.current.scrollTop = conversation.current.scrollHeight;
        }
    }, [
        session,
        expanded,
    ]);
    const messages = session?.events.reduce<readonly TranscriptEntry[]>((entries, { event, sequence }) => {

        return event.type === "sessionReset" ? [] : appendAgentEvent(entries, event, sequence);
    }, []) ?? [];
    const send = async () => {

        const text = draft.trim();
        if (!text || busy || changingAgent) {
            return;
        }
        setSending(true); setError(undefined);
        try {
            const id = session && session.kind === "interactive" && session.status !== "stopped" ? session.id : (await window.avesd.agentSessions.create("flagship")).id;
            setDraft(""); follow.current = true;
            await window.avesd.agentSessions.prompt(id, text);
        } catch (cause) { fail(cause); } finally { setSending(false); }
    };

    const applyRuntime = async (route: AgentTierRoute) => {

        setChangingAgent(true); setError(undefined);
        try {
            if (session && session.kind === "interactive" && session.status !== "stopped" && session.route.providerId === route.providerId) {
                await window.avesd.agentSessions.configureSession(session.id, route);
            } else {
                const created = await window.avesd.agentSessions.create("flagship", route);
                await window.avesd.agentSessions.connect(created.id);
            }
            const routes = await window.avesd.agentSessions.routes();
            await window.avesd.agentSessions.configure({
                ...routes,
                flagship: route,
            });
        } finally { setChangingAgent(false); }
    };
    const newConversation = () => {

        void window.avesd.agentSessions.create("flagship").catch(fail);
    };

    return <main
        className={`controller ${expanded ? "is-expanded" : "is-collapsed"}`}
        aria-label="Avesd controller"
    >
        <header
            className="controller-header"
        >
            <span
                className={`controller-status ${busy ? "is-busy" : ""}`}
                aria-label={busy ? "Agent working" : "Agent idle"}
            />
            <button
                className="controller-toggle"
                onClick={() => {

                    void window.avesd.views.controller(!expanded).catch(fail);
                }}
                aria-label={expanded ? "Collapse controller" : "Open controller"}
            >
                <strong>Avesd</strong>
                <span>
                    {busy ? "Working…" : expanded ? "Your dashboard agent" : "Ask anything"}
                </span>
            </button>
            {expanded && <button
                className="controller-icon"
                aria-label="Collapse"
                onClick={() => {

                    void window.avesd.views.controller(false).catch(fail);
                }}
            >
                <ChevronDown
                    size={16}
                />
            </button>}
        </header>
        {expanded && <>
            <nav
                className="controller-nav"
                aria-label="Controller panels"
            >
                <button
                    aria-pressed={panel === "chat"}
                    onClick={() => {

                        setPanel("chat");
                    }}
                >
                    <MessageCircle
                        size={15}
                    />
                    Chat
                </button>
                <button
                    aria-pressed={panel === "canvases"}
                    onClick={() => {

                        setPanel("canvases");
                    }}
                >
                    <Layers
                        size={15}
                    />
                    Dashboards
                </button>
                <button
                    aria-pressed={panel === "sessions"}
                    onClick={() => {

                        setPanel("sessions");
                    }}
                >
                    Sessions
                </button>
                <button
                    aria-label="Settings"
                    aria-pressed={panel === "settings"}
                    onClick={() => {

                        setPanel("settings");
                    }}
                >
                    <Settings2
                        size={15}
                    />
                </button>
            </nav>
            {panel === "chat" && <>
                <div
                    className="controller-conversation"
                    ref={conversation}
                    onScroll={event => {

                        const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
                    }}
                >
                    {!messages.length && <div
                        className="controller-welcome"
                    >
                        <MessageCircle
                            size={28}
                        />
                        <h1>What are we working on?</h1>
                        <p>Ask me to create, find, or organize your dashboards.</p>
                        <span>I’ll find the right dashboard.</span>
                    </div>}
                    {messages.map(entry => {

                        return entry.kind === "tool" ? <details
                            className="controller-tool"
                            key={entry.id}
                        >
                            <summary>
                                {entry.title}
                                {" "}
                                ·
                                {" "}
                                {entry.status}
                            </summary>
                            {entry.input && <pre>
                                {entry.input}
                            </pre>}
                            {entry.output && <pre>
                                {entry.output}
                            </pre>}
                        </details>
                            : entry.kind === "thought" ? <details
                                className="controller-tool"
                                key={entry.id}
                            >
                                <summary>Reasoning</summary>
                                <AgentMarkdown
                                    text={entry.text}
                                />
                            </details>
                                : <article
                                    className={`controller-message is-${entry.kind}`}
                                    key={entry.id}
                                >
                                    <AgentMarkdown
                                        text={entry.text}
                                    />
                                </article>;
                    })}
                    {busy && <p
                        className="controller-activity"
                        role="status"
                    >
                        Working across your dashboards…
                    </p>}
                </div>
                <AgentRuntimePicker
                    api={window.avesd.agentSessions}
                    providersApi={window.avesd.agentProviders}
                    session={session}
                    disabled={busy}
                    applying={changingAgent}
                    apply={applyRuntime}
                    newConversation={newConversation}
                    manage={() => {

                        setPanel("settings");
                    }}
                />
                <form
                    className="controller-composer"
                    onSubmit={event => {

                        event.preventDefault(); void send();
                    }}
                >
                    <textarea
                        ref={composer}
                        disabled={changingAgent}
                        aria-label="Message your agent"
                        placeholder="Ask anything…"
                        value={draft}
                        maxLength={32000}
                        onChange={event => {

                            setDraft(event.target.value);
                        }}
                        onKeyDown={event => {

                            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault(); void send();
                            }
                        }}
                    />
                    {busy ? <button
                        type="button"
                        aria-label="Stop agent"
                        onClick={() => {

                            if (session) {
                                void window.avesd.agentSessions.cancel(session.id).catch(fail);
                            }
                        }}
                    >
                        <Square
                            size={15}
                        />
                    </button> : <button
                        type="submit"
                        aria-label="Send message"
                        disabled={!draft.trim() || changingAgent}
                    >
                        <ArrowUp
                            size={18}
                        />
                    </button>}
                </form>
            </>}
            {panel === "canvases" && <section
                className="controller-content"
            >
                <div
                    className="controller-section-title"
                >
                    <h1>Your dashboards</h1>
                </div>
                {canvases.map(canvas => {

                    return <div
                        className="controller-canvas"
                        key={canvas.id}
                    >
                        <button
                            onClick={() => {

                                void window.avesd.views.open(canvas.id).catch(fail);
                            }}
                        >
                            <Layers
                                size={17}
                            />
                            <span>
                                {canvas.title}
                            </span>
                        </button>
                        <span>
                            r
                            {canvas.revision}
                        </span>
                    </div>;
                })}
            </section>}
            {panel === "sessions" && <section
                className="controller-content"
            >
                <div
                    className="controller-section-title"
                >
                    <h1>Conversations</h1>
                    <button
                        aria-label="New conversation"
                        onClick={() => {

                            void window.avesd.agentSessions.create("flagship").then(() => {

                                setPanel("chat");
                            })
                                .catch(fail);
                        }}
                    >
                        <Plus
                            size={17}
                        />
                    </button>
                </div>
                {sessions.map(item => {

                    return <div
                        className="controller-session"
                        key={item.id}
                    >
                        <button
                            onClick={() => {

                                void window.avesd.agentSessions.select(item.id).then(() => {

                                    setPanel("chat");
                                })
                                    .catch(fail);
                            }}
                        >
                            {item.route.providerId}
                            {" "}
                            ·
                            {" "}
                            {item.waitingForAnswer && item.status !== "running" ? "Waiting for answer" : item.status}
                            <small>
                                {new Date(item.createdAt).toLocaleTimeString()}
                            </small>
                        </button>
                        <button
                            aria-label="Remove conversation"
                            onClick={() => {

                                void window.avesd.agentSessions.remove(item.id).catch(fail);
                            }}
                        >
                            ×
                        </button>
                    </div>;
                })}
            </section>}
            {panel === "settings" && <section
                className="controller-content"
            >
                <h1>Agent settings</h1>
                <AgentProviderSettings
                    api={window.avesd.agentProviders}
                />
                <AgentTierSettings
                    api={window.avesd.agentSessions}
                    providersApi={window.avesd.agentProviders}
                />
            </section>}
            {error && <div
                className="controller-error"
                role="alert"
            >
                {error}
                <button
                    aria-label="Dismiss error"
                    onClick={() => {

                        setError(undefined);
                    }}
                >
                    ×
                </button>
            </div>}
        </>}
    </main>;
}
