/**
 * @author Avesd
 * @package Style Utils
 * @namespace Root
 * @description Cn
 */

import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeClasses = extendTailwindMerge<"typography">({
    extend: {
        classGroups: {
            typography: [
                {
                    type: [
                        "display",
                        "title",
                        "heading",
                        "subheading",
                        "body",
                        "supporting",
                        "ui",
                        "input",
                        "data",
                        "caption",
                        "eyebrow",
                        "code",
                        "metric",
                    ],
                },
            ],
        },
        theme: {
            spacing: [
                "avesd-0",
                "avesd-4",
                "avesd-8",
                "avesd-16",
                "avesd-24",
                "avesd-32",
                "avesd-48",
                "avesd-64",
            ],
            radius: ["control"],
        },
    },
});

export const cn = (...classes: ClassValue[]): string => {

    return mergeClasses(clsx(classes));
};
