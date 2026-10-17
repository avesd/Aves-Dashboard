/**
 * @author Avesd
 * @package Dropdown Menu
 * @namespace Dropdown
 * @description Dropdown
 */

import { dropdownContentStyles, dropdownIndicatorStyles, dropdownItemStyles, dropdownLabelStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import * as Primitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ComponentPropsWithRef, FC } from "react";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export type DropdownMenuContentProps = ComponentPropsWithRef<typeof Primitive.Content>;

export const DropdownMenuContent: FC<DropdownMenuContentProps> = (props: DropdownMenuContentProps) => {

    const {
        className,
        sideOffset = 8,
        align = "end",
        ...restProps
    } = props;

    return (<Primitive.Portal>
        <Primitive.Content
            {...restProps}
            align={align}
            sideOffset={sideOffset}
            className={cn(dropdownContentStyles(), className)}
        />
    </Primitive.Portal>);
};

export type DropdownMenuItemProps = ComponentPropsWithRef<typeof Primitive.Item>;

export const DropdownMenuItem: FC<DropdownMenuItemProps> = (props: DropdownMenuItemProps) => {

    const {
        className,
        ...restProps
    } = props;

    return (<Primitive.Item
        {...restProps}
        className={cn(dropdownItemStyles(), className)}
    />);
};

export type DropdownMenuRadioItemProps = ComponentPropsWithRef<typeof Primitive.RadioItem>;

export const DropdownMenuRadioItem: FC<DropdownMenuRadioItemProps> = (props: DropdownMenuRadioItemProps) => {

    const {
        className,
        children,
        ...restProps
    } = props;

    return (<Primitive.RadioItem
        {...restProps}
        className={cn(dropdownItemStyles(), className)}
    >
        <span
            className={cn(dropdownIndicatorStyles())}
            aria-hidden="true"
        >
            <Primitive.ItemIndicator>
                <Check
                    size={16}
                    aria-hidden="true"
                />
            </Primitive.ItemIndicator>
        </span>
        {children}
    </Primitive.RadioItem>);
};

export type DropdownMenuLabelProps = ComponentPropsWithRef<typeof Primitive.Label>;

export const DropdownMenuLabel: FC<DropdownMenuLabelProps> = (props: DropdownMenuLabelProps) => {

    const {
        className,
        ...restProps
    } = props;

    return (<Primitive.Label
        {...restProps}
        className={cn(dropdownLabelStyles(), className)}
    />);
};
