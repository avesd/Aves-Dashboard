/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Components
 * @description Controller
 */

import { CanvasesPanel } from "../canvases/CanvasesPanel";
import { useCanvases } from "../canvases/useCanvases";
import { ChatComposer } from "../chat/ChatComposer";
import { ChatTranscript } from "../chat/ChatTranscript";
import { useControllerApi } from "../controller-context";
import { AgentRuntimePicker } from "../runtime-picker/AgentRuntimePicker";
import { SessionsPanel } from "../sessions/SessionsPanel";
import { useAgentSessions } from "../sessions/useAgentSessions";
import { VoiceControls } from "../voice/VoiceControls";
import type { AgentTierRoute } from "@avesd/desktop-contracts/agent/sessions";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import { Button } from "@avesd/ui-controls";
import { BirdMark } from "@avesd/ui-logo";
import { ChevronDown, Layers, MessageCircle, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function controllerStatusLabel(busy: boolean, expanded: boolean): string {

    if (busy) {
        return "Working…";
    }

    return expanded ? "Your dashboard agent" : "Ask anything";
}

export function Controller({ expanded }: {
    readonly expanded: boolean;
}) {

    const api = useControllerApi();
    const [
        panel,
        setPanel,
    ] = useState<"chat" | "canvases" | "sessions">("chat");
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
    const fail = useCallback((cause: unknown) => {

        setError(ipcErrorMessage(cause, "Operation failed."));
    }, []);
    const { sessions, session } = useAgentSessions(api, fail);
    const canvases = useCanvases(api, fail);
    const busy = sending || session?.status === "running";
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
    const send = async () => {

        const text = draft.trim();
        if (!text || changingAgent || (sending && session?.status !== "running")) {
            return;
        }
        setSending(true);
        setError(undefined);
        try {
            const id = session && session.kind === "interactive" && session.status !== "stopped" ? session.id : (await api.agentSessions.create("flagship")).id;
            setDraft("");
            follow.current = true;
            if (session?.status === "running" || session?.waitingForAnswer) {
                await api.agentSessions.enqueue(id, text);
            } else {
                await api.agentSessions.prompt(id, text);
            }
        } catch (cause) {
            fail(cause);
        } finally {
            setSending(false);
        }
    };

    const applyRuntime = async (route: AgentTierRoute) => {

        setChangingAgent(true);
        setError(undefined);
        try {
            if (session && session.kind === "interactive" && session.status !== "stopped" && session.route.providerId === route.providerId) {
                await api.agentSessions.configureSession(session.id, route);
            } else {
                const created = await api.agentSessions.create("flagship", route);
                await api.agentSessions.connect(created.id);
            }
            await api.agentSessions.configureFlagship(route);
        } finally {
            setChangingAgent(false);
        }
    };
    const newConversation = () => {

        void api.agentSessions.create("flagship").catch(fail);
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
            <Button
                variant="quiet"
                size="small"
                className="controller-toggle flex-1 min-w-0 justify-start gap-avesd-8 border-0 rounded-none p-0 bg-transparent"
                onClick={() => {

                    void api.views.controller(!expanded).catch(fail);
                }}
                aria-label={expanded ? "Collapse controller" : "Open controller"}
            >
                <BirdMark
                    detail="compact"
                    width={20}
                    height={20}
                />
                <strong>Avesd</strong>
                <span>
                    {controllerStatusLabel(busy, expanded)}
                </span>
            </Button>
            {expanded && <Button
                variant="quiet"
                size="small"
                className="controller-icon w-[28px] min-h-[28px] border-0 p-0"
                aria-label="Collapse"
                onClick={() => {

                    void api.views.controller(false).catch(fail);
                }}
            >
                <ChevronDown
                    size={16}
                />
            </Button>}
        </header>
        {expanded && <>
            <nav
                className="controller-nav"
                aria-label="Controller panels"
            >
                <Button
                    className="w-full min-w-0 min-h-[44px] rounded-none border-0 border-l border-border first:border-l-0 px-avesd-4 py-avesd-8 text-muted aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    variant="quiet"
                    size="small"
                    aria-pressed={panel === "chat"}
                    onClick={() => {

                        setPanel("chat");
                    }}
                >
                    <MessageCircle
                        size={15}
                    />
                    Chat
                </Button>
                <Button
                    className="w-full min-w-0 min-h-[44px] rounded-none border-0 border-l border-border first:border-l-0 px-avesd-4 py-avesd-8 text-muted aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    variant="quiet"
                    size="small"
                    aria-pressed={panel === "canvases"}
                    onClick={() => {

                        setPanel("canvases");
                    }}
                >
                    <Layers
                        size={15}
                    />
                    Dashboards
                </Button>
                <Button
                    className="w-full min-w-0 min-h-[44px] rounded-none border-0 border-l border-border first:border-l-0 px-avesd-4 py-avesd-8 text-muted aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    variant="quiet"
                    size="small"
                    aria-pressed={panel === "sessions"}
                    onClick={() => {

                        setPanel("sessions");
                    }}
                >
                    Sessions
                </Button>
                <Button
                    className="w-full min-w-0 min-h-[44px] rounded-none border-0 border-l border-border first:border-l-0 px-avesd-4 py-avesd-8 text-muted aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    variant="quiet"
                    size="small"
                    aria-label="Settings"
                    onClick={() => {

                        void api.settings.open().catch(fail);
                    }}
                >
                    <Settings2
                        size={15}
                    />
                </Button>
            </nav>
            {panel === "chat" && <>
                <ChatTranscript
                    session={session}
                    busy={busy}
                    conversation={conversation}
                    follow={follow}
                />
                <VoiceControls
                    agentId={session?.kind === "interactive" && session.status !== "stopped" ? session.id : undefined}
                    disabled={changingAgent}
                />
                {!!session?.queuedPrompts.length && <p
                    className="controller-activity"
                >
                    {session.queuedPrompts.length}
                    {" "}
                    additional request(s) queued
                </p>}
                <AgentRuntimePicker
                    api={api.agentSessions}
                    providersApi={api.agentProviders}
                    session={session}
                    disabled={busy}
                    applying={changingAgent}
                    apply={applyRuntime}
                    newConversation={newConversation}
                    manage={() => {

                        void api.settings.open().catch(fail);
                    }}
                />
                <ChatComposer
                    composer={composer}
                    draft={draft}
                    setDraft={setDraft}
                    busy={busy}
                    changingAgent={changingAgent}
                    session={session}
                    send={send}
                    fail={fail}
                />
            </>}
            {panel === "canvases" && <CanvasesPanel
                canvases={canvases}
                fail={fail}
            />}
            {panel === "sessions" && <SessionsPanel
                sessions={sessions}
                fail={fail}
                openChat={() => {

                    setPanel("chat");
                }}
            />}
            {error && <div
                className="controller-error"
                role="alert"
            >
                {error}
                <Button
                    variant="quiet"
                    size="small"
                    aria-label="Dismiss error"
                    onClick={() => {

                        setError(undefined);
                    }}
                >
                    ×
                </Button>
            </div>}
        </>}
    </main>;
}
