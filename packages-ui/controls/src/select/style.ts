/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Style
 */

import { dropdownContentStyles, dropdownItemStyles } from "../dropdown/style";
import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const selectContentStyles = cva(cn(
    dropdownContentStyles(),
    "avesd-select-content relative flex flex-col overflow-hidden min-w-0 w-[var(--anchor-width)] max-w-[var(--available-width)] max-h-[var(--available-height)]",
));
export const selectItemStyles = cva(cn(dropdownItemStyles(), "min-w-0"));
export const selectMenuItemStyles = cva(cn(selectItemStyles(), "relative px-avesd-4 pr-[36px]"));
export const selectIndicatorStyles = cva("absolute inset-y-0 right-avesd-4 flex w-[1rem] items-center justify-center text-foreground");
export const selectIconStyles = cva("inline-flex shrink-0 items-center [&_svg]:size-[1rem]");

export const selectOptionContentStyles = cva("min-w-0 flex-1 whitespace-normal wrap-anywhere");
export const selectOptionDescriptionStyles = cva("block text-muted type-caption mt-avesd-4");
export const selectListStyles = cva("min-h-0 overflow-y-auto");
export const selectEmptyStyles = cva("p-avesd-8 text-muted type-caption");
export const selectActionsStyles = cva("shrink-0 border-t border-border pt-avesd-4");
export const selectActionStyles = cva(cn(
    selectItemStyles(),
    "w-full text-start whitespace-normal wrap-anywhere hover:bg-surface focus-visible:bg-surface",
));

export const comboboxInputStyles = cva("pr-[44px] text-ellipsis");
export const comboboxTriggerStyles = cva("absolute inset-y-0 right-0 flex w-[36px] items-center justify-center rounded-control text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50");
export const comboboxContentStyles = cva(cn(
    dropdownContentStyles(),
    "avesd-combobox-content flex flex-col overflow-hidden min-w-0 w-[var(--anchor-width)] max-h-[var(--available-height)] max-w-[var(--available-width)]",
));

export const selectScrollArrowStyles = cva("absolute inset-x-0 z-[1] flex h-[24px] items-center justify-center bg-background text-foreground", {
    variants: {
        direction: {
            up: "top-0",
            down: "bottom-0",
        },
    },
});
