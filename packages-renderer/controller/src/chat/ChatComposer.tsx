/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Chat
 * @description ChatComposer
 */

import { useControllerApi } from "../controller-context";
import type { AgentSessionSnapshot } from "@avesd/desktop-contracts/agent/sessions";
import { Button, Textarea } from "@avesd/ui-controls";
import { ArrowUp, Square } from "lucide-react";
import type { RefObject } from "react";

interface Props {
    readonly composer: RefObject<HTMLTextAreaElement | null>;
    readonly draft: string;
    readonly setDraft: (draft: string) => void;
    readonly busy: boolean;
    readonly changingAgent: boolean;
    readonly session: AgentSessionSnapshot | null;
    readonly send: () => Promise<void>;
    readonly fail: (cause: unknown) => void;
}

export function ChatComposer({ composer, draft, setDraft, busy, changingAgent, session, send, fail }: Props) {

    const api = useControllerApi();

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
        {busy && !draft.trim() ? <Button
            layout="icon"
            variant="primary"
            size="small"
            type="button"
            aria-label="Cancel current turn"
            onClick={() => {

                if (session) {
                    void api.agentSessions.cancelTurn(session.id).catch(fail);
                }
            }}
        >
            <Square
                size={15}
            />
        </Button> : <Button
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
        </Button>}
    </form>;
}
