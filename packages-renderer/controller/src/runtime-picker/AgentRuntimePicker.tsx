/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description AgentRuntimePicker
 */

import type { RuntimePickerProps } from "./runtime-picker-types";
import { RuntimePickerDialog } from "./RuntimePickerDialog";
import { useRuntimePicker } from "./useRuntimePicker";
import { Button, Popover, PopoverAnchor, PopoverTrigger } from "@avesd/ui-controls";
import { Split } from "@avesd/ui-grid";
import { ChevronDown, Plus } from "lucide-react";

/** Everyday selection belongs beside the message, installation details belong in Settings. */
export function AgentRuntimePicker(props: RuntimePickerProps) {

    const { disabled, applying, newConversation, session, manage } = props;
    const picker = useRuntimePicker(props);
    const { open, draft, selected, currentName, modelName, effortName, close, initial } = picker;

    return <Popover
        open={open}
        hoverEnabled={false}
        onOpenChange={next => {

            if (next) {
                initial();
            } else {
                close();
            }
        }}
    >
        <PopoverAnchor
            asChild
        >
            <Split
                className="controller-runtime"
            >
                <PopoverTrigger
                    variant="quiet"
                    size="small"
                    type="button"
                    className="controller-runtime-trigger flex-1 min-w-0 min-h-[44px] justify-start gap-gridui-8 border-0 rounded-none px-[12px] py-gridui-8 data-[state=open]:bg-transparent"
                    aria-label="Choose Agent, model and effort"
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    disabled={disabled || applying || !selected}
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
                </PopoverTrigger>
                <Button
                    variant="quiet"
                    size="small"
                    type="button"
                    className="controller-runtime-new shrink-0 w-[44px] h-[44px] min-h-[44px] rounded-none border-0 p-0"
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
            </Split>
        </PopoverAnchor>
    </Popover>;
}
