/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Chat
 * @description ChatTranscript
 */

import { AgentMarkdown } from "./agent-markdown";
import type { TranscriptEntry } from "./agent-transcript";
import { appendAgentEvent } from "./agent-transcript";
import type { AgentSessionSnapshot } from "@avesd/desktop-contracts/agent/sessions";
import { MessageCircle } from "lucide-react";
import type { RefObject } from "react";

interface Props {
    readonly session: AgentSessionSnapshot | null;
    readonly conversation: RefObject<HTMLDivElement | null>;
    readonly follow: RefObject<boolean>;
}

export function ChatTranscript({ session, conversation, follow }: Props) {

    const messages = session?.events.reduce<readonly TranscriptEntry[]>((entries, { event, sequence }) => {

        return event.type === "sessionReset" ? [] : appendAgentEvent(entries, event, sequence);
    }, []) ?? [];

    return <div
        className="controller-conversation"
        ref={conversation}
        onScroll={event => {

            const node = event.currentTarget;
            follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
        }}
    >
        {!messages.length && <div
            className="controller-welcome"
        >
            <MessageCircle
                size={28}
            />
            <h1>What would you like to work on?</h1>
        </div>}
        {messages.map(entry => {

            if (entry.kind === "tool") {
                return <details
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
                </details>;
            }
            if (entry.kind === "thought") {
                return <details
                    className="controller-tool"
                    key={entry.id}
                >
                    <summary>Reasoning</summary>
                    <AgentMarkdown
                        text={entry.text}
                    />
                </details>;
            }

            return <article
                className={`controller-message is-${entry.kind}`}
                key={entry.id}
            >
                <AgentMarkdown
                    text={entry.text}
                />
            </article>;
        })}
    </div>;
}
