/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Editable combobox with Tips styling and Base UI interaction
 */

import { controlVariants } from "../form/input/style";
import { ComboboxOptions } from "./combobox-options";
import { filterOptions, flattenOptions } from "./options";
import { SelectionActions } from "./selection-actions";
import { SelectionForm } from "./selection-form";
import { comboboxContentStyles, comboboxInputStyles, comboboxTriggerStyles, selectEmptyStyles } from "./style";
import type { SelectionProps, SelectOption } from "./types";
import { useSelectionState } from "./use-selection-state";
import { cn } from "@avesd/ui-style-utils";
import { Combobox as Primitive } from "@base-ui/react/combobox";
import { ChevronDown, X } from "lucide-react";
import type { ComponentPropsWithRef, FC } from "react";
import { useRef } from "react";

export type ComboboxProps = Omit<ComponentPropsWithRef<"input">,
    "children" | "value" | "defaultValue" | "onChange" | "type" | "size"> & SelectionProps & {
        readonly searchLabel: string;
        readonly emptyLabel: string;
    };

export const Combobox: FC<ComboboxProps> = (props: ComboboxProps) => {

    const {
        options, actions = [], value, defaultValue = "", onValueChange,
        controlSize = "standard", clearLabel, required, disabled, readOnly, name, form, dir,
        portalContainer, className, ref, searchLabel, emptyLabel, placeholder, onKeyDown, ...inputProps
    } = props;
    const { selectedValue, open, controlRef, change, changeOpen, close, focus, reset, runAction } = useSelectionState({
        value,
        defaultValue,
        onValueChange,
        disabled,
    });
    const groupRef = useRef<HTMLDivElement | null>(null);
    const allOptions = flattenOptions(options);
    const groups = options.map((entry, index) => {

        if ("options" in entry) {
            return {
                key: index,
                label: entry.label,
                items: [...entry.options],
            };
        }

        return {
            key: index,
            label: undefined,
            items: [entry],
        };
    });
    const items = Primitive.createItems<SelectOption, string>(groups, {
        getValue: option => {

            return option.value;
        },
        getLabel: option => {

            return option.label;
        },
    });

    return (<Primitive.Root
        items={items}
        value={selectedValue}
        disabled={disabled}
        readOnly={readOnly}
        open={open}
        onOpenChange={changeOpen}
        onValueChange={change}
        filter={(option, query) => {

            return filterOptions([option], query).length > 0;
        }}
        autoHighlight
    >
        <div
            className="relative flex min-w-0 w-full items-stretch gap-avesd-4"
            dir={dir}
        >
            <Primitive.InputGroup
                ref={groupRef}
                className="relative flex min-w-0 flex-1 items-stretch"
            >
                <Primitive.Input
                    {...inputProps}
                    ref={(element) => {

                        controlRef.current = element;
                        if (typeof ref === "function") {
                            return ref(element);
                        }
                        if (ref) {
                            ref.current = element;
                        }
                    }}
                    aria-label={inputProps["aria-label"] ?? searchLabel}
                    aria-required={required}
                    placeholder={placeholder ?? searchLabel}
                    autoComplete="off"
                    form={form}
                    className={cn(controlVariants({ size: controlSize }), comboboxInputStyles(), className)}
                    onKeyDown={(event) => {

                        onKeyDown?.(event);
                        if (open && event.key === "Escape") {
                            event.stopPropagation();
                        }
                    }}
                />
                <Primitive.Trigger
                    aria-label={searchLabel}
                    className={comboboxTriggerStyles()}
                >
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                    />
                </Primitive.Trigger>
            </Primitive.InputGroup>
            {clearLabel && (<button
                type="button"
                disabled={disabled || required || selectedValue === ""}
                aria-label={clearLabel}
                onClick={() => {

                    change("");
                    close();
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
                anchor={groupRef}
                sideOffset={8}
                align="start"
                collisionPadding={16}
                className="z-[50]"
            >
                <Primitive.Popup
                    className={comboboxContentStyles()}
                    dir={dir}
                    initialFocus={false}
                    finalFocus={false}
                    onKeyDown={(event) => {

                        if (event.key === "Escape") {
                            event.stopPropagation();
                        }
                    }}
                >
                    <Primitive.Empty
                        role="status"
                    >
                        <div
                            className={selectEmptyStyles()}
                        >
                            {emptyLabel}
                        </div>
                    </Primitive.Empty>
                    <ComboboxOptions />
                    <SelectionActions
                        actions={actions}
                        onAction={runAction}
                    />
                </Primitive.Popup>
            </Primitive.Positioner>
        </Primitive.Portal>
    </Primitive.Root>);
};
