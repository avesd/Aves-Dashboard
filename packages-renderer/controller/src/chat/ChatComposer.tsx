/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Chat
 * @description ChatComposer
 */

import { Composer } from "@avesd/ui-layout";
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

    return <Composer
        className="controller-composer border-0 border-t p-[12px]"
        layout="inline"
        value={draft}
        onValueChange={setDraft}
        onSubmit={() => {

            void send();
        }}
        busy={busy}
        editableWhileBusy
        submitWhileBusy
        submitShortcut="enter"
        disabled={changingAgent}
        placeholder={busy ? "Add a requirement for the next turn…" : "Ask anything…"}
        textareaProps={{
            ref: composer,
            maxLength: 32000,
            autoSize: false,
            className: "h-[72px] min-h-0 min-w-0 resize-none rounded-none border-0 bg-transparent p-gridui-8 type-supporting",
        }}
        submitButtonProps={{
            layout: "icon",
            variant: "primary",
            size: "small",
            className: "h-[36px] w-[36px] min-h-0 p-0",
        }}
        submitContent={<ArrowUp
            size={18}
        />}
        labels={{
            input: "Message your agent",
            submit: "Send message",
            stop: "Stop request",
            attach: "Attach files",
            attachments: "Attachments",
            removeAttachment: item => {

                return `Remove ${item.name}`;
            },
        }}
    />;
}
