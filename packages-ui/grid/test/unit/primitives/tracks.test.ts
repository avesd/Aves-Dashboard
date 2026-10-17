/**
 * @author Avesd
 * @package UI Grid
 * @namespace Test_Unit_Primitives
 * @description Tracks.test
 */

import { fillGridRowSpans, gridTemplate } from "../../../src/primitives/grid/tracks.ts";
import { resolveResponsive } from "../../../src/primitives/responsive.ts";
import { deepStrictEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";

void test("incomplete rows fill before a full-width item without changing earlier complete rows", () => {

    deepStrictEqual(fillGridRowSpans(3, [
        1,
        1,
        1,
        1,
        3,
        1,
        1,
    ]), [
        1,
        1,
        1,
        3,
        3,
        1,
        2,
    ]);
});

void test("responsive geometry inherits the nearest configured breakpoint", () => {

    deepStrictEqual(resolveResponsive({
        base: 1,
        md: 2,
    }), {
        base: 1,
        md: 2,
        lg: 2,
    });
    deepStrictEqual(resolveResponsive({
        base: 1,
        lg: 3,
    }), {
        base: 1,
        md: 1,
        lg: 3,
    });
});

void test("content tracks can shrink beside automatic action tracks", () => {

    equal(gridTemplate([
        "1fr",
        "auto",
    ]), "minmax(0, 1fr) auto");
});

void test("out-of-range spans fail before producing invalid layout geometry", () => {

    throws(() => {

        return fillGridRowSpans(2, [3]);
    }, RangeError);
    throws(() => {

        return fillGridRowSpans(2, [0]);
    }, RangeError);
});
