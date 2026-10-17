/**
 * @author Avesd
 * @package UI Controls
 * @namespace Test_Unit_Select
 * @description Search preserves grouped option semantics
 */

import { filterOptions, flattenOptions } from "../../../src/select/options.ts";
import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";

void test("search normalizes Unicode and matches model IDs without enabling disabled options", () => {

    const options = [
        {
            value: "model-a",
            label: "Model A",
            description: "reasoning-v2",
            disabled: true,
        },
    ];
    const matches = flattenOptions(filterOptions(options, "  ＲＥＡＳＯＮＩＮＧ  "));
    deepStrictEqual(matches, options);
    equal(matches[0]?.disabled, true);
});

void test("empty search restores the full list and filtering removes empty groups", () => {

    const options = [
        {
            label: "Models",
            options: [
                {
                    value: "a",
                    label: "Alpha",
                },
            ],
        },
    ];
    equal(filterOptions(options, " "), options);
    deepStrictEqual(filterOptions(options, "missing"), []);
    equal(flattenOptions(filterOptions(options, "alpha"))[0]?.value, "a");
});
