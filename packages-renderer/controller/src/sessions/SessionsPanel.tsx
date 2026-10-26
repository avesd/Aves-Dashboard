/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Sessions
 * @description SessionsPanel
 */

import { useControllerApi } from "../controller-context";
import type { AgentSessionSummary } from "@avesd/desktop-contracts/agent/sessions";
import { Button, CollectionItem, CollectionItemButton } from "@avesd/ui-controls";
import { Row, Split } from "@avesd/ui-grid";
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
        <Split
            direction="column"
        >
            <Row
                align="center"
                justify="between"
                gap={16}
                className="controller-section-title"
            >
                <h1
                    className="controller-panel-heading"
                >
                    Conversations
                </h1>
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
            </Row>
            <ul
                className="m-0 list-none p-0"
                aria-label="Conversations"
            >
                {sessions.map(item => {

                    const status = item.waitingForAnswer && item.status !== "running" ? "Waiting for answer" : item.status;

                    return <CollectionItem
                        className="px-gridui-16"
                        key={item.id}
                        actions={<Button
                            variant="quiet"
                            size="small"
                            layout="icon"
                            aria-label="Remove conversation"
                            onClick={() => {

                                void api.agentSessions.remove(item.id).catch(fail);
                            }}
                        >
                            ×
                        </Button>}
                    >
                        <CollectionItemButton
                            className="min-h-[64px] flex-wrap rounded-none px-gridui-8 py-[12px] type-ui"
                            title={<span
                                className="flex flex-wrap items-center gap-[12px]"
                            >
                                {`${item.route.providerId} · ${status}`}
                                <small
                                    className="text-muted type-caption"
                                >
                                    {new Date(item.createdAt).toLocaleTimeString()}
                                </small>
                            </span>}
                            onClick={() => {

                                void api.agentSessions.select(item.id).then(() => {

                                    openChat();
                                })
                                    .catch(fail);
                            }}
                        />
                    </CollectionItem>;
                })}
            </ul>
        </Split>
    </section>;
}
