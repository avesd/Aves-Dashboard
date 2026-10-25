/**
 * @author Avesd
 * @package Renderer Agent
 * @namespace Test_Unit
 * @description Saved route values survive option refreshes
 */

import { providerSelectOptions, routeSelectOptions } from "../../src/route-select-options.ts";
import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";

void test("a removed provider remains visible but cannot be selected again", () => {

    deepStrictEqual(providerSelectOptions([], "removed"), [
        {
            value: "removed",
            label: "removed · unavailable",
            disabled: true,
        },
    ]);
});

void test("provider choices use local readiness rather than installation status", () => {

    const providers = [
        {
            id: "configured",
            name: "Configured",
            kind: "api" as const,
            enabled: true,
            readiness: "configured" as const,
        },
        {
            id: "missing",
            name: "Missing",
            kind: "api" as const,
            enabled: true,
            readiness: "missing" as const,
        },
    ];

    const choices = providerSelectOptions(providers, "configured");

    equal(choices[0]!.disabled, false);
    equal(choices[1]!.disabled, true);
});

void test("unavailable saved models coexist with an explicit default choice", () => {

    const choices = routeSelectOptions([
        {
            id: "new-model",
            name: "New model",
        },
    ], "old-model", "Agent default", "not offered");
    equal(choices[0]?.value, "");
    equal(choices[1]?.value, "old-model");
    equal(choices[1].disabled, true);
    equal(choices[2]?.description, "new-model");
});

void test("offered selections are not duplicated and empty options still expose the default", () => {

    equal(routeSelectOptions([
        {
            id: "a",
            name: "Alpha",
        },
    ], "a", "Default").length, 2);
    deepStrictEqual(routeSelectOptions(undefined, "", "Default"), [
        {
            value: "",
            label: "Default",
        },
    ]);
});
