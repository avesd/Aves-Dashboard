/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Rail
 * @description Style
 */

import { cva } from "class-variance-authority";

export const frameRailStyles = cva("avesd-frame-rail flex h-full box-border flex-col py-avesd-24 text-muted");

export const frameRailContentStyles = cva("avesd-frame-rail-content relative z-[3] min-w-0 type-eyebrow bg-inherit");

export const frameRailStickyBottomStyles = cva("avesd-frame-rail-sticky-bottom justify-end [&>.avesd-frame-rail-content]:sticky");
