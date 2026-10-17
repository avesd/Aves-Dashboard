/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Select interaction with shared Tips styling and selectable positioning
 */

import { controlVariants } from "../form/input/style";
import { flattenOptions } from "./options";
import { SelectOptions } from "./select-options";
import { SelectionActions } from "./selection-actions";
import { SelectionForm } from "./selection-form";
import { selectContentStyles, selectIconStyles, selectScrollArrowStyles } from "./style";
import type { SelectionProps } from "./types";
import { useSelectionState } from "./use-selection-state";
import { cn } from "@avesd/ui-style-utils";
import { Select as Primitive } from "@base-ui/react/select";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { ComponentPropsWithRef, FC } from "react";

export type SelectProps = Omit<ComponentPropsWithRef<"button">,
    "children" | "value" | "defaultValue" | "onChange" | "type"> & SelectionProps & {
        readonly placeholder?: string;
        readonly position?: "item-aligned" | "popper";
    };

export const Select: FC<SelectProps> = (props: SelectProps) => {

    const {
        options, actions = [], value, defaultValue = "", onValueChange, placeholder,
        controlSize = "standard", position = "item-aligned", clearLabel, required, disabled, name, form, dir, portalContainer,
        className, ref, ...triggerProps
    } = props;
    const { selectedValue, open, controlRef, change, changeOpen, focus, reset, runAction } = useSelectionState({
        value,
        defaultValue,
        onValueChange,
        disabled,
    });
    const allOptions = flattenOptions(options);
    const selected = allOptions.find(option => {

        return option.value === selectedValue;
    });
    const display = selected?.label ?? placeholder ?? selectedValue;

    return (<Primitive.Root
        items={allOptions}
        value={selectedValue}
        disabled={disabled}
        open={open}
        onOpenChange={changeOpen}
        onValueChange={change}
    >
        <div
            className="relative flex min-w-0 w-full items-stretch gap-avesd-4"
            dir={dir}
        >
            <Primitive.Trigger
                {...triggerProps}
                form={form}
                aria-required={required}
                ref={(element) => {

                    controlRef.current = element;
                    if (typeof ref === "function") {
                        return ref(element);
                    }
                    if (ref) {
                        ref.current = element;
                    }
                }}
                className={cn(controlVariants({ size: controlSize }), "flex flex-1 items-center gap-avesd-8 text-start", className)}
            >
                {selected?.icon && (<span
                    className={selectIconStyles()}
                    aria-hidden="true"
                >
                    {selected.icon}
                </span>)}
                <Primitive.Value
                    className="min-w-0 flex-1 whitespace-normal wrap-anywhere"
                >
                    {display}
                </Primitive.Value>
                <Primitive.Icon>
                    <ChevronDown
                        size={16}
                        className="shrink-0"
                        aria-hidden="true"
                    />
                </Primitive.Icon>
            </Primitive.Trigger>
            {clearLabel && (<button
                type="button"
                disabled={disabled || required || selectedValue === ""}
                aria-label={clearLabel}
                onClick={() => {

                    change("");
                    controlRef.current?.focus();
                }}
                className={cn(controlVariants({ size: controlSize }), "flex w-auto shrink-0 items-center justify-center min-w-[44px] cursor-pointer hover:enabled:bg-surface")}
            >
                <X
                    size={16}
                    aria-hidden="true"
                />
            </button>)}
            <SelectionForm
                name={name}
                form={form}
                required={required}
                disabled={disabled}
                selectedValue={selectedValue}
                allOptions={allOptions}
                onValueChange={change}
                onReset={reset}
                onInvalid={focus}
            />
        </div>
        <Primitive.Portal
            container={portalContainer}
        >
            <Primitive.Positioner
                alignItemWithTrigger={position === "item-aligned"}
                align="start"
                sideOffset={8}
                collisionPadding={16}
                className="z-[50]"
            >
                <Primitive.Popup
                    className={selectContentStyles()}
                    dir={dir}
                    finalFocus={controlRef}
                    onKeyDown={(event) => {

                        if (event.key === "Escape") {
                            event.stopPropagation();
                        }
                    }}
                >
                    <Primitive.ScrollUpArrow
                        className={selectScrollArrowStyles({ direction: "up" })}
                    >
                        <ChevronUp
                            size={16}
                            aria-hidden="true"
                        />
                    </Primitive.ScrollUpArrow>
                    <SelectOptions
                        options={options}
                    />
                    <SelectionActions
                        actions={actions}
                        onAction={runAction}
                    />
                    <Primitive.ScrollDownArrow
                        className={selectScrollArrowStyles({ direction: "down" })}
                    >
                        <ChevronDown
                            size={16}
                            aria-hidden="true"
                        />
                    </Primitive.ScrollDownArrow>
                </Primitive.Popup>
            </Primitive.Positioner>
        </Primitive.Portal>
    </Primitive.Root>);
};
