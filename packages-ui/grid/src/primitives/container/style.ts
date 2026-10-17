/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Container
 * @description Style
 */

import { cva } from "class-variance-authority";

export const containerVariants = cva("avesd-container", {
    variants: {
        width: {
            narrow: "avesd-container-narrow",
            standard: "avesd-container-standard",
            wide: "avesd-container-wide",
        },
    },
    defaultVariants: { width: "standard" },
});
