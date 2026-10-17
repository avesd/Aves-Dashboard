/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Row
 * @description Row
 */

import type { Space } from "../responsive";
import { spaceValue } from "../responsive";
import { rowStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, FC } from "react";

export type RowProps = ComponentPropsWithRef<"div"> & {
    readonly gap?: Space;
    readonly rowGap?: Space;
    readonly align?: "stretch" | "center" | "baseline" | "end";
    readonly justify?: "start" | "between";
    readonly wrap?: boolean;
    readonly inline?: boolean;
};

export const Row: FC<RowProps> = (props: RowProps) => {

    const {
        gap = 16,
        rowGap = gap,
        align = "stretch",
        justify = "start",
        wrap = true,
        inline = false,
        className,
        style,
        ...restProps
    } = props;

    return (<div
        {...restProps}
        className={cn(rowStyles(), className)}
        data-inline={inline}
        style={{
            display: inline ? "inline-flex" : "flex",
            alignItems: align,
            justifyContent: justify === "between" ? "space-between" : "flex-start",
            flexWrap: wrap ? "wrap" : "nowrap",
            gap: `${spaceValue(rowGap)} ${spaceValue(gap)}`,
            ...style,
        }}
    />);
};
