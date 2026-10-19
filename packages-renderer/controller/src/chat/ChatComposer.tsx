/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Chat
 * @description ChatComposer
 */

import { Button, Textarea } from "@avesd/ui-controls";
import { ArrowUp } from "lucide-react";
import type { RefObject } from "react";

interface Props {
    readonly composer: RefObject<HTMLTextAreaElement | null>;
    readonly draft: string;
    readonly setDraft: (draft: string) => void;
    readonly busy: boolean;
    readonly changingAgent: boolean;
    readonly send: () => Promise<void>;
}

export function ChatComposer({ composer, draft, setDraft, busy, changingAgent, send }: Props) {

    return <form
        className="controller-composer"
        onSubmit={event => {

            event.preventDefault();
            void send();
        }}
    >
        <Textarea
            className="min-w-0 resize-none rounded-none border-0 bg-transparent type-supporting"
            ref={composer}
            disabled={changingAgent}
            aria-label="Message your agent"
            placeholder={busy ? "Add a requirement for the next turn…" : "Ask anything…"}
            value={draft}
            maxLength={32000}
            onChange={event => {

                setDraft(event.target.value);
            }}
            onKeyDown={event => {

                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                }
            }}
        />
        <Button
            layout="icon"
            variant="primary"
            size="small"
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || changingAgent}
        >
            <ArrowUp
                size={18}
            />
        </Button>
    </form>;
}
