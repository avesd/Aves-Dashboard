/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Chrome
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const frameChromeStyles = cva(cn(
    "avesd-frame-chrome",
    "flex flex-wrap items-center justify-between gap-avesd-16",
));

export const frameSignatureStyles = cva(cn(
    "avesd-frame-signature flex min-w-0 items-center justify-center gap-avesd-24 py-avesd-32 px-avesd-24 overflow-hidden border-t border-solid border-border bg-transparent",
    "[&>svg]:h-auto [&>svg]:opacity-30 [&>span]:font-display [&>span]:leading-none [&>span]:text-transparent",
));

export const frameSignatureCroppedStyles = cva("avesd-frame-signature-cropped block pb-0 @container [&>span]:block [&>span]:text-center [&>span]:whitespace-nowrap");
