/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Types
 */

import type { ReactNode } from "react";

export type SelectOption = {
    readonly value: string;
    readonly label: string;
    readonly description?: string;
    readonly icon?: ReactNode;
    readonly disabled?: boolean;
};
export type SelectGroup = {
    readonly label: string;
    readonly options: readonly SelectOption[];
};
export type SelectAction = {
    readonly id: string;
    readonly label: string;
    readonly icon?: ReactNode;
    readonly disabled?: boolean;
    readonly closeOnAction?: boolean;
} & ({
    readonly href: string;
    readonly target?: string;
    readonly rel?: string;
    readonly onAction?: never;
} | {
    readonly onAction: () => void;
    readonly href?: never;
});

export interface SelectionValueProps {
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
}

export interface SelectionProps extends SelectionValueProps {
    readonly options: readonly (SelectOption | SelectGroup)[];
    readonly actions?: readonly SelectAction[];
    readonly controlSize?: "standard" | "small";
    readonly clearLabel?: string;
    readonly portalContainer?: HTMLElement | null;
    readonly name?: string;
    readonly form?: string;
    readonly required?: boolean;
    readonly disabled?: boolean;
}
