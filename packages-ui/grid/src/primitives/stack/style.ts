/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Stack
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const stackStyles = cva(cn(
    "avesd-stack",
    "flex min-w-0 flex-col",
));
