/**
 * @author Avesd
 * @package Button
 * @namespace Button
 * @description Button
 */

import type { ButtonVariants } from "./style";
import { buttonClass } from "./style";
import type { ComponentPropsWithRef, FC, ReactNode } from "react";

export type ButtonProps = ComponentPropsWithRef<"button"> & ButtonVariants & {
    readonly loading?: boolean;
    readonly leading?: ReactNode;
};

export const Button: FC<ButtonProps> = (props: ButtonProps) => {

    const {
        variant,
        size,
        layout,
        loading = false,
        leading,
        disabled,
        type = "button",
        className,
        children,
        ...restProps
    } = props;

    return (<button
        {...restProps}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || restProps["aria-busy"]}
        className={buttonClass({
            variant,
            size,
            layout,
        }, className)}
    >
        {leading}
        {children}
    </button>);
};

export type ButtonLinkProps = ComponentPropsWithRef<"a"> & ButtonVariants & {
    readonly href: string;
};

export const ButtonLink: FC<ButtonLinkProps> = (props: ButtonLinkProps) => {

    const {
        variant = "secondary",
        size,
        layout,
        className,
        ...restProps
    } = props;

    return (<a
        {...restProps}
        className={buttonClass({
            variant,
            size,
            layout,
        }, className)}
    />);
};
