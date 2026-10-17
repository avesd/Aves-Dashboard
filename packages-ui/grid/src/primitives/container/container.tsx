/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Container
 * @description Container
 */

import type { ElementProps } from "../types";
import { containerVariants } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { FC } from "react";

export type ContainerProps = ElementProps & {
    readonly width?: "narrow" | "standard" | "wide";
};

export const Container: FC<ContainerProps> = (props: ContainerProps) => {

    const { width = "standard", className, ...restProps } = props;

    return (<div
        {...restProps}
        className={cn(containerVariants({ width }), className)}
    />);
};
