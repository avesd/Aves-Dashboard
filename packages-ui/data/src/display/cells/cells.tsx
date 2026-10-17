/**
 * @author Avesd
 * @package Data
 * @namespace Display_Cells
 * @description Cells
 */

import { dataBadgeStyles, dataBarStyles, dataBarTrackStyles, dataMonoStyles, dataValueStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, FC, ReactNode } from "react";

export type DataValueProps = ComponentPropsWithRef<"span"> & {
    readonly detail?: ReactNode;
    readonly mono?: boolean;
};

export const DataValue: FC<DataValueProps> = (props: DataValueProps) => {

    const {
        children,
        detail,
        mono = false,
        className,
        ...restProps
    } = props;

    return (<span
        {...restProps}
        className={cn(dataValueStyles(), mono && dataMonoStyles(), className)}
    >
        <span>
            {children}
        </span>
        {detail !== undefined && (<small>
            {detail}
        </small>)}
    </span>);
};

export type DataBadgeProps = ComponentPropsWithRef<"span"> & {
    readonly tone?: "neutral" | "accent";
};

export const DataBadge: FC<DataBadgeProps> = (props: DataBadgeProps) => {

    const {
        children,
        tone = "neutral",
        className,
        ...restProps
    } = props;

    return (<span
        {...restProps}
        className={cn(dataBadgeStyles(), className)}
        data-tone={tone}
    >
        {children}
    </span>);
};

export type DataBarProps = ComponentPropsWithRef<"span"> & {
    readonly value: number;
    readonly maximum: number;
    readonly partial?: boolean;
};

export const DataBar: FC<DataBarProps> = (props: DataBarProps) => {

    const {
        value,
        maximum,
        partial = false,
        children,
        className,
        ...restProps
    } = props;
    const ratio = Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0
        ? Math.max(0, Math.min(1, value / maximum))
        : 0;

    return (<span
        {...restProps}
        className={cn(dataBarStyles(), className)}
        data-partial={partial}
    >
        <span>
            {children}
        </span>
        <span
            className={cn(dataBarTrackStyles())}
            aria-hidden="true"
        >
            <span
                style={{ width: `${ratio * 100}%` }}
            />
        </span>
    </span>);
};
