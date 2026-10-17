/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Select options with text anchors for selected-item alignment
 */

import { dropdownLabelStyles } from "../dropdown/style";
import { selectIconStyles, selectIndicatorStyles, selectListStyles, selectMenuItemStyles, selectOptionContentStyles, selectOptionDescriptionStyles } from "./style";
import type { SelectGroup, SelectOption } from "./types";
import { Select as Primitive } from "@base-ui/react/select";
import { Check } from "lucide-react";

interface SelectOptionsProps {
    readonly options: readonly (SelectOption | SelectGroup)[];
}

export function SelectOptions({ options }: SelectOptionsProps) {

    const renderOption = (option: SelectOption) => {

        return (<Primitive.Item
            key={option.value}
            value={option.value}
            label={option.label}
            disabled={option.disabled}
            className={selectMenuItemStyles()}
        >
            {option.icon && (<span
                className={selectIconStyles()}
                aria-hidden="true"
            >
                {option.icon}
            </span>)}
            <span
                className={selectOptionContentStyles()}
            >
                <Primitive.ItemText>
                    {option.label}
                </Primitive.ItemText>
                {option.description && (<span
                    className={selectOptionDescriptionStyles()}
                >
                    {option.description}
                </span>)}
            </span>
            <Primitive.ItemIndicator
                className={selectIndicatorStyles()}
                aria-hidden="true"
            >
                <Check
                    size={16}
                />
            </Primitive.ItemIndicator>
        </Primitive.Item>);
    };

    return (<Primitive.List
        className={selectListStyles()}
    >
        {options.map((entry) => {

            if (!("options" in entry)) {
                return renderOption(entry);
            }

            return (<Primitive.Group
                key={entry.label}
            >
                <Primitive.GroupLabel
                    className={dropdownLabelStyles()}
                >
                    {entry.label}
                </Primitive.GroupLabel>
                {entry.options.map(renderOption)}
            </Primitive.Group>);
        })}
    </Primitive.List>);
}
