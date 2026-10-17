/**
 * @author Avesd
 * @package Form Controls
 * @namespace Form_Input
 * @description Controls
 */

import { controlVariants, labelStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, FC } from "react";

export type LabelProps = ComponentPropsWithRef<"label">;

export const Label: FC<LabelProps> = (props: LabelProps) => {

    const { className, ...restProps } = props;

    return (<label
        {...restProps}
        className={cn(labelStyles(), className)}
    />);
};
export type InputProps = ComponentPropsWithRef<"input"> & {
    readonly controlSize?: "standard" | "small";
    readonly onValueChange?: (value: string) => void;
};

export const Input: FC<InputProps> = (props: InputProps) => {

    const {
        size,
        controlSize = "standard",
        className,
        onChange,
        onValueChange,
        ...restProps
    } = props;

    return (<input
        {...restProps}
        size={size}
        onChange={(event) => {

            onChange?.(event);
            onValueChange?.(event.currentTarget.value);
        }}
        className={cn(controlVariants({ size: controlSize }), className)}
    />);
};

export type NativeSelectProps = ComponentPropsWithRef<"select"> & {
    readonly controlSize?: "standard" | "small";
};

export function NativeSelect({ className, controlSize = "standard", ...props }: NativeSelectProps) {

    return <select
        {...props}
        className={cn(controlVariants({ size: controlSize }), className)}
    />;
}

export type TextareaProps = ComponentPropsWithRef<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {

    return <textarea
        {...props}
        className={cn(controlVariants(), "resize-y", className)}
    />;
}
