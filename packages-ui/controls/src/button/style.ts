/**
 * @author Avesd
 * @package Button
 * @namespace Button
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export const buttonStyles = cva(cn(
    "avesd-button",
    "inline-flex w-fit max-w-full min-w-0 items-center justify-center gap-avesd-8 border border-solid border-transparent rounded-control type-ui text-center no-underline wrap-anywhere cursor-pointer transition-colors duration-(--avesd-motion-duration-quick) ease-(--avesd-motion-ease-out)",
    "[&_svg]:w-[1rem] [&_svg]:h-[1rem] [&_svg]:shrink-0 [&_svg]:pointer-events-none",
    "[&:disabled]:opacity-50 [&:disabled]:cursor-not-allowed",
    "[&:hover:not(:disabled)]:border-foreground",
    "[&:active:not(:disabled)]:[opacity:0.8]",
    "motion-reduce:transition-none",
));

export const buttonStandardStyles = cva(cn(
    "avesd-button-standard",
    "min-h-[44px] py-avesd-8 px-avesd-16",
));

export const buttonSmallStyles = cva(cn(
    "avesd-button-small",
    "min-h-[36px] py-avesd-4 px-avesd-8",
));

export const buttonPrimaryStyles = cva(cn(
    "avesd-button-primary",
    "text-accent-foreground bg-accent-background border-accent-background",
));

export const buttonSecondaryStyles = cva(cn(
    "avesd-button-secondary",
    "text-foreground bg-transparent border-border",
    "[&:hover:not(:disabled)]:bg-surface-hover",
));

export const buttonQuietStyles = cva(cn(
    "avesd-button-quiet",
    "text-foreground bg-transparent",
    "[&:hover:not(:disabled)]:bg-surface-hover",
));

export const buttonEntryStyles = cva(cn(
    "avesd-button-entry",
    "justify-between w-full py-avesd-16 px-avesd-24 bg-background",
));

export const buttonRailStyles = cva(cn(
    "avesd-button-rail",
    "w-full min-w-[24px] flex-col py-avesd-8 px-0",
    "[&_>_span]:[writing-mode:vertical-rl] [&_>_span]:whitespace-nowrap",
));

export const buttonIconStyles = cva(cn(
    "avesd-button-icon",
    "w-[44px] h-[44px] shrink-0 p-0",
    "[&.avesd-button-small]:w-[36px] [&.avesd-button-small]:h-[36px]",
    "[@media(pointer:coarse)]:[&.avesd-button-small]:w-[44px] [@media(pointer:coarse)]:[&.avesd-button-small]:h-[44px]",
));

export const buttonVariants = cva(buttonStyles(), {
    variants: {
        variant: {
            primary: buttonPrimaryStyles(),
            secondary: buttonSecondaryStyles(),
            quiet: buttonQuietStyles(),
        },
        size: {
            small: buttonSmallStyles(),
            standard: buttonStandardStyles(),
        },
        layout: {
            standard: "",
            icon: buttonIconStyles(),
            entry: buttonEntryStyles(),
            rail: buttonRailStyles(),
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "standard",
    },
});

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export const buttonClass = (variants: ButtonVariants = {}, className?: string): string => {

    return cn(buttonVariants(variants), className);
};
