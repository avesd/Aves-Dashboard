/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Options
 */

import type { SelectGroup, SelectOption } from "./types";

export const flattenOptions = (options: readonly (SelectOption | SelectGroup)[]): SelectOption[] => {

    return options.flatMap((entry) => {

        return "options" in entry ? entry.options : [entry];
    });
};

export const filterOptions = (
    options: readonly (SelectOption | SelectGroup)[],
    query: string,
): readonly (SelectOption | SelectGroup)[] => {

    const term = query.trim().normalize("NFKC")
        .toLowerCase();
    if (!term) {
        return options;
    }
    const matches = (option: SelectOption): boolean => {

        return `${option.label} ${option.description ?? ""}`.normalize("NFKC")
            .toLowerCase()
            .includes(term);
    };

    return options.flatMap((entry): (SelectOption | SelectGroup)[] => {

        if ("options" in entry) {
            const items = entry.options.filter(matches);

            return items.length ? [
                {
                    ...entry,
                    options: items,
                },
            ] : [];
        }

        return matches(entry) ? [entry] : [];
    });
};
