/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Native submission, validation, and reset bridge for selection controls
 */

import type { SelectionProps, SelectOption } from "./types";
import type { FC } from "react";
import { useEffect, useEffectEvent, useRef } from "react";

export type SelectionFormProps = {
    readonly [Key in "name" | "form" | "required" | "disabled"]: SelectionProps[Key];
} & {
    readonly selectedValue: string;
    readonly allOptions: readonly SelectOption[];
    readonly onValueChange: (value: string) => void;
    readonly onReset: () => void;
    readonly onInvalid: () => void;
};

export const SelectionForm: FC<SelectionFormProps> = (props: SelectionFormProps) => {

    const { name, form, required, disabled, selectedValue, allOptions, onValueChange, onReset, onInvalid } = props;
    const nativeRef = useRef<HTMLSelectElement | null>(null);
    const resetSelection = useEffectEvent(onReset);
    useEffect(() => {

        const owner = nativeRef.current?.form;
        let mounted = true;
        const reset = (event: Event): void => {

            setTimeout(() => {

                if (mounted && !event.defaultPrevented) {
                    resetSelection();
                }
            }, 0);
        };
        owner?.addEventListener("reset", reset);

        return () => {

            mounted = false;
            owner?.removeEventListener("reset", reset);
        };
    }, [form]);

    return (<select
        ref={nativeRef}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        name={name}
        form={form}
        required={required}
        disabled={disabled}
        value={selectedValue}
        onChange={(event) => {

            onValueChange(event.currentTarget.value);
        }}
        onInvalid={(event) => {

            event.preventDefault();
            onInvalid();
        }}
    >
        {!allOptions.some((option) => {

            return option.value === "";
        }) && (<option
            value=""
        />)}
        {allOptions.map((option) => {

            return (<option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
            >
                {option.label}
            </option>);
        })}
    </select>);
};
