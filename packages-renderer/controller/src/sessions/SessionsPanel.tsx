/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Sessions
 * @description SessionsPanel
 */

import { useControllerApi } from "../controller-context";
import type { AgentSessionSummary } from "@avesd/desktop-contracts/agent/sessions";
import { Button } from "@avesd/ui-controls";
import { Plus } from "lucide-react";

interface Props {
    readonly sessions: readonly AgentSessionSummary[];
    readonly fail: (cause: unknown) => void;
    readonly openChat: () => void;
}

export function SessionsPanel({ sessions, fail, openChat }: Props) {

    const api = useControllerApi();

    return <section
        className="controller-content"
    >
        <div
            className="controller-section-title"
        >
            <h1>Conversations</h1>
            <Button
                variant="quiet"
                size="small"
                layout="icon"
                aria-label="New conversation"
                onClick={() => {

                    void api.agentSessions.create("flagship").then(() => {

                        openChat();
                    })
                        .catch(fail);
                }}
            >
                <Plus
                    size={17}
                />
            </Button>
        </div>
        {sessions.map(item => {

            return <div
                className="controller-session"
                key={item.id}
            >
                <Button
                    className="flex-1 min-w-0 justify-start min-h-[64px] border-0 rounded-none text-left"
                    variant="quiet"
                    size="small"
                    onClick={() => {

                        void api.agentSessions.select(item.id).then(() => {

                            openChat();
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
                </Button>
                <Button
                    variant="quiet"
                    size="small"
                    layout="icon"
                    aria-label="Remove conversation"
                    onClick={() => {

                        void api.agentSessions.remove(item.id).catch(fail);
                    }}
                >
                    ×
                </Button>
            </div>;
        })}
    </section>;
}
