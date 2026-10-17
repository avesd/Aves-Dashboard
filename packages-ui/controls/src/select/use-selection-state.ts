/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Shared selection values, availability guards, and open-state transitions
 */

import type { SelectAction, SelectionProps } from "./types";
import { useEffect, useRef, useState } from "react";

type SelectionStateProps = Pick<SelectionProps, "value" | "defaultValue" | "onValueChange" | "disabled">;

export function useSelectionState({ value, defaultValue = "", onValueChange, disabled }: SelectionStateProps) {

    const [
        localValue,
        setLocalValue,
    ] = useState(defaultValue);
    const [
        open,
        setOpen,
    ] = useState(false);
    const controlRef = useRef<HTMLElement | null>(null);
    const selectedValue = value ?? localValue;
    const initialValue = useRef(selectedValue);
    useEffect(() => {

        if (disabled) {
            setOpen(false);
        }
    }, [disabled]);
    const isDisabled = (): boolean => {

        return Boolean(disabled || controlRef.current?.matches(":disabled"));
    };
    const change = (next: string | null): void => {

        if (next === null || isDisabled()) {
            return;
        }
        if (value === undefined) {
            setLocalValue(next);
        }
        onValueChange?.(next);
    };
    const changeOpen = (next: boolean, details: {
        cancel: () => void;
    }): void => {

        if (next && isDisabled()) {
            details.cancel();

            return;
        }
        setOpen(next);
    };
    const close = (): void => {

        setOpen(false);
    };
    const focus = (): void => {

        controlRef.current?.focus();
    };
    const reset = (): void => {

        change(initialValue.current);
        close();
    };
    const runAction = (action: SelectAction): void => {

        if (action.disabled) {
            return;
        }
        if (action.closeOnAction !== false) {
            close();
            focus();
        }
        action.onAction?.();
    };

    return {
        selectedValue,
        open: open && !disabled,
        controlRef,
        change,
        changeOpen,
        close,
        focus,
        reset,
        runAction,
    };
}
