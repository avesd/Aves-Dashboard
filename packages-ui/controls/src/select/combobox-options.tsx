/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Grouped combobox options using the shared Tips option styles
 */

import { dropdownIndicatorStyles, dropdownLabelStyles } from "../dropdown/style";
import { selectIconStyles, selectItemStyles, selectListStyles, selectOptionContentStyles, selectOptionDescriptionStyles } from "./style";
import type { SelectOption } from "./types";
import { Combobox as Primitive } from "@base-ui/react/combobox";
import { Check } from "lucide-react";

interface ComboboxGroup {
    readonly key: number;
    readonly label?: string;
    readonly items: readonly SelectOption[];
}

export function ComboboxOptions() {

    return (<Primitive.List
        className={selectListStyles()}
    >
        {(group: ComboboxGroup) => {

            return (<Primitive.Group
                key={group.key}
                items={group.items}
            >
                {group.label && (<Primitive.GroupLabel
                    className={dropdownLabelStyles()}
                >
                    {group.label}
                </Primitive.GroupLabel>)}
                <Primitive.Collection>
                    {(option: SelectOption) => {

                        return (<Primitive.Item
                            key={option.value}
                            value={option.value}
                            disabled={option.disabled}
                            className={selectItemStyles()}
                        >
                            <span
                                className={dropdownIndicatorStyles()}
                                aria-hidden="true"
                            >
                                <Primitive.ItemIndicator>
                                    <Check
                                        size={16}
                                    />
                                </Primitive.ItemIndicator>
                            </span>
                            {option.icon && (<span
                                className={selectIconStyles()}
                                aria-hidden="true"
                            >
                                {option.icon}
                            </span>)}
                            <span
                                className={selectOptionContentStyles()}
                            >
                                <span>
                                    {option.label}
                                </span>
                                {option.description && (<span
                                    className={selectOptionDescriptionStyles()}
                                >
                                    {option.description}
                                </span>)}
                            </span>
                        </Primitive.Item>);
                    }}
                </Primitive.Collection>
            </Primitive.Group>);
        }}
    </Primitive.List>);
}
