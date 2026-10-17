/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description AgentRuntimePicker
 */

import type { RuntimePickerProps } from "./runtime-picker-types";
import { RuntimePickerDialog } from "./RuntimePickerDialog";
import { useRuntimePicker } from "./useRuntimePicker";
import { Button } from "@avesd/ui-controls";
import { ChevronDown, Plus } from "lucide-react";

/** Everyday selection belongs beside the message, installation details belong in Settings. */
export function AgentRuntimePicker(props: RuntimePickerProps) {

    const { disabled, applying, newConversation, session, manage } = props;
    const picker = useRuntimePicker(props);
    const { container, trigger, open, draft, selected, currentName, modelName, effortName, close, initial } = picker;

    return <div
        className="controller-runtime"
        ref={container}
    >
        <Button
            variant="quiet"
            size="small"
            ref={trigger}
            type="button"
            className="controller-runtime-trigger w-full min-w-0 min-h-[44px] justify-start gap-avesd-8 border-0 rounded-none px-[12px] py-avesd-8"
            aria-label="Choose Agent, model and effort"
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={disabled || applying || !selected}
            onClick={() => {

                if (open) {
                    close();
                } else {
                    initial();
                }
            }}
        >
            <span
                className="controller-runtime-provider"
            >
                {currentName}
            </span>
            <span
                className="controller-runtime-model"
                title={modelName}
            >
                {modelName || "Agent default"}
            </span>
            <span
                className="controller-runtime-effort"
            >
                {effortName || "Default"}
            </span>
            <ChevronDown
                size={12}
                aria-hidden="true"
            />
        </Button>
        <Button
            variant="quiet"
            size="small"
            type="button"
            className="controller-runtime-new w-[44px] h-[44px] min-h-[44px] rounded-none border-0 border-l border-border p-0"
            aria-label="New conversation"
            title="New conversation"
            disabled={disabled || applying}
            onClick={newConversation}
        >
            <Plus
                size={16}
            />
        </Button>
        {open && draft && <RuntimePickerDialog
            picker={picker}
            applying={applying}
            session={session}
            manage={manage}
        />}
    </div>;
}
