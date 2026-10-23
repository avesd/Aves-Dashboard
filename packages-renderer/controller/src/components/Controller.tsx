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
import { controllerTaskLabel } from "./controller-task-label";
import type { AgentTierRoute } from "@avesd/desktop-contracts/agent/sessions";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import { Button } from "@avesd/ui-controls";
import { BirdMark } from "@avesd/ui-logo";
import { ChevronDown, ChevronUp, Keyboard, Layers, MessageCircle, Settings2, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
        pendingRequests,
        setPendingRequests,
    ] = useState<readonly {
        sessionId: string | undefined;
    }[]>([]);
    const submissions = useRef(pendingRequests);
    const [
        changingAgent,
        setChangingAgent,
    ] = useState(false);
    const [
        textVisible,
        setTextVisible,
    ] = useState(false);
    const detailsToggle = useRef<HTMLButtonElement>(null);
    const textToggle = useRef<HTMLButtonElement>(null);
    const composer = useRef<HTMLTextAreaElement>(null);
    const conversation = useRef<HTMLDivElement>(null);
    const follow = useRef(true);
    const fail = useCallback((cause: unknown) => {

        setError(ipcErrorMessage(cause, "Operation failed."));
    }, []);
    const { sessions, session } = useAgentSessions(api, fail);
    const canvases = useCanvases(api, fail);
    const targetId = session?.kind === "interactive" && session.status !== "stopped" ? session.id : undefined;
    const sending = pendingRequests.some(request => {

        return request.sessionId === targetId;
    });
    const busy = sending || session?.status === "running";
    const canCancel = session?.kind === "interactive" && session.status !== "stopped"
        && (session.status === "running" || session.waitingForAnswer || session.queuedPrompts.length > 0);
    useEffect(() => {

        if (expanded && panel === "chat" && textVisible) {
            composer.current?.focus();
        }
    }, [
        expanded,
        panel,
        textVisible,
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
        const pending = submissions.current.some(request => {

            return request.sessionId === targetId;
        });
        if (!text || changingAgent || (pending && session?.status !== "running")) {
            return;
        }
        const request = { sessionId: targetId };
        // Keep admission synchronous while React schedules the corresponding render.
        submissions.current = [
            ...submissions.current,
            request,
        ];
        setPendingRequests(submissions.current);
        setError(undefined);
        try {
            const id = targetId ?? (await api.agentSessions.create("flagship")).id;
            request.sessionId = id;
            setPendingRequests([...submissions.current]);
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
            submissions.current = submissions.current.filter(pending => {

                return pending !== request;
            });
            setPendingRequests(submissions.current);
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

    const toggleDetails = () => {

        void api.views.controller(!expanded).then(() => {

            detailsToggle.current?.focus();
        })
            .catch(fail);
    };
    const toggleText = () => {

        if (expanded && panel === "chat" && textVisible) {
            setTextVisible(false);
            textToggle.current?.focus();

            return;
        }
        setPanel("chat");
        setTextVisible(true);
        if (!expanded) {
            void api.views.controller(true).catch(fail);
        } else {
            composer.current?.focus();
        }
    };
    const showingText = expanded && panel === "chat" && textVisible;

    return <main
        className={`controller ${expanded ? "is-expanded" : "is-collapsed"}`}
        aria-label="Avesd controller"
    >
        <header
            className="controller-header"
        >
            <BirdMark
                detail="compact"
                width={22}
                height={22}
            />
            <strong>Avesd</strong>
            <span
                className="controller-mode"
            >
                Voice workspace
            </span>
            <Button
                variant="quiet"
                size="small"
                layout="icon"
                aria-label="Settings"
                onClick={() => {

                    void api.settings.open().catch(fail);
                }}
            >
                <Settings2
                    size={16}
                />
            </Button>
        </header>
        <VoiceControls
            agentId={session?.kind === "interactive" && session.status !== "stopped" ? session.id : undefined}
            disabled={changingAgent}
            expanded={expanded}
        />
        <div
            className="controller-task"
            role="status"
        >
            <span
                className={`controller-status ${busy ? "is-busy" : ""}`}
            />
            <span>
                {controllerTaskLabel(session, sending)}
            </span>
            {canCancel && <Button
                variant="quiet"
                size="small"
                onClick={() => {

                    void api.agentSessions.cancelTurn(session.id).catch(fail);
                }}
            >
                <Square
                    size={13}
                />
                Cancel task
            </Button>}
        </div>
        <div
            className="controller-input-actions"
        >
            <Button
                ref={textToggle}
                variant="quiet"
                size="small"
                aria-expanded={showingText}
                aria-controls="controller-text-input"
                onClick={toggleText}
            >
                <Keyboard
                    size={16}
                />
                {showingText ? "Hide text input" : "Text input"}
            </Button>
            <Button
                ref={detailsToggle}
                variant="quiet"
                size="small"
                aria-label={expanded ? "Collapse controller" : "Open controller"}
                aria-expanded={expanded}
                aria-controls="controller-details"
                onClick={toggleDetails}
            >
                {expanded ? <ChevronDown
                    size={16}
                /> : <ChevronUp
                    size={16}
                />}
                {expanded ? "Hide details" : "View details"}
            </Button>
        </div>
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
        <section
            id="controller-details"
            className="controller-details"
            hidden={!expanded}
            aria-label="Workspace details"
        >
            <nav
                className="controller-nav"
                aria-label="Controller panels"
            >
                <Button
                    variant="quiet"
                    size="small"
                    className="aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    aria-pressed={panel === "chat"}
                    onClick={() => {

                        setPanel("chat");
                    }}
                >
                    <MessageCircle
                        size={15}
                    />
                    Conversation
                </Button>
                <Button
                    variant="quiet"
                    size="small"
                    className="aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    aria-pressed={panel === "canvases"}
                    onClick={() => {

                        setPanel("canvases");
                    }}
                >
                    <Layers
                        size={15}
                    />
                    Canvases
                </Button>
                <Button
                    variant="quiet"
                    size="small"
                    className="aria-pressed:bg-brand-tint aria-pressed:text-accent-background"
                    aria-pressed={panel === "sessions"}
                    onClick={() => {

                        setPanel("sessions");
                    }}
                >
                    Sessions
                </Button>
            </nav>
            <div
                className="controller-chat"
                hidden={panel !== "chat"}
            >
                <ChatTranscript
                    session={session}
                    busy={busy}
                    conversation={conversation}
                    follow={follow}
                />
                {!!session?.queuedPrompts.length && <p
                    className="controller-activity"
                >
                    {session.queuedPrompts.length}
                    {" "}
                    additional request(s) queued
                </p>}
                <div
                    id="controller-text-input"
                    hidden={!textVisible}
                >
                    <ChatComposer
                        composer={composer}
                        draft={draft}
                        setDraft={setDraft}
                        busy={busy}
                        changingAgent={changingAgent}
                        send={send}
                    />
                </div>
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
            </div>
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
        </section>
    </main>;
}
