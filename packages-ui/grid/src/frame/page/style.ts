/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Page
 * @description Style
 */

import { cva } from "class-variance-authority";

export const pageFrameVariants = cva("avesd-page-frame min-h-svh", {
    variants: {
        width: {
            narrow: "avesd-container-narrow",
            standard: "avesd-container-standard",
            wide: "avesd-container-wide",
        },
    },
    defaultVariants: { width: "standard" },
});
