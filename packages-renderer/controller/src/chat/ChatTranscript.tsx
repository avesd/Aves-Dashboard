/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Chat
 * @description ChatTranscript
 */

import { AgentMarkdown } from "./agent-markdown";
import { projectAgentTranscript } from "./agent-transcript";
import type { AgentSessionSnapshot } from "@avesd/desktop-contracts/agent/sessions";
import { Disclosure } from "@avesd/ui-controls";
import { CodeView } from "@avesd/ui-data";
import { MessageCircle } from "lucide-react";
import type { RefObject } from "react";

interface Props {
    readonly session: AgentSessionSnapshot | null;
    readonly conversation: RefObject<HTMLDivElement | null>;
    readonly content: RefObject<HTMLDivElement | null>;
}

export function ChatTranscript({ session, conversation, content }: Props) {

    const messages = projectAgentTranscript(session);

    return <div
        className="controller-conversation"
        ref={conversation}
    >
        <div
            className="controller-transcript-content"
            ref={content}
        >
            {!messages.length && <div
                className="controller-welcome"
            >
                <MessageCircle
                    size={28}
                />
                <h1
                    className="controller-welcome-heading"
                >
                    What would you like to work on?
                </h1>
            </div>}
            {messages.map(entry => {

                if (entry.kind === "tool") {
                    return <Disclosure
                        className="controller-tool type-caption"
                        summaryClassName="min-h-0 text-inherit"
                        summaryPaddingBlock={0}
                        summaryPaddingInline={0}
                        contentPadding={0}
                        key={entry.id}
                        label={`${entry.title} · ${entry.status}`}
                    >
                        {entry.input && <CodeView
                            code={entry.input}
                            label={`${entry.title} input`}
                            className="border-0 bg-transparent p-0 text-inherit text-[length:inherit] whitespace-pre-wrap"
                        />}
                        {entry.output && <CodeView
                            code={entry.output}
                            label={`${entry.title} output`}
                            className="border-0 bg-transparent p-0 text-inherit text-[length:inherit] whitespace-pre-wrap"
                        />}
                    </Disclosure>;
                }
                if (entry.kind === "thought") {
                    return <Disclosure
                        className="controller-tool type-caption"
                        summaryClassName="min-h-0 text-inherit"
                        summaryPaddingBlock={0}
                        summaryPaddingInline={0}
                        contentPadding={0}
                        key={entry.id}
                        label="Reasoning"
                    >
                        <AgentMarkdown
                            text={entry.text}
                        />
                    </Disclosure>;
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
        </div>
    </div>;
}
