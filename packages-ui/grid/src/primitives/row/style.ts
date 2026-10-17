/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Row
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const rowStyles = cva(cn(
    "avesd-row",
    "min-w-0",
));
