/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives
 * @description Types
 */

import type { ComponentPropsWithRef, CSSProperties } from "react";

export type LayoutStyle = CSSProperties & {
    [key: `--avesd-${string}`]: string | number;
};
export type ElementProps = ComponentPropsWithRef<"div">;
