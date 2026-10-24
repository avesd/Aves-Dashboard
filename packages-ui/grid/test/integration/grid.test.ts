/**
 * @author Avesd
 * @package UI Grid
 * @namespace Test_Integration
 * @description Public GridUI rendering preserves responsive geometry and invalid-span recovery
 */

import type { Span } from "../../src/index.ts";
import { Grid, GridItem } from "../../src/index.ts";
import { deepStrictEqual, match, throws } from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

void test("incomplete rows fill without changing earlier complete rows", () => {

    const spans = [
        1,
        1,
        1,
        1,
        3,
        1,
        1,
    ] as const;
    const html = renderToStaticMarkup(createElement(Grid, {
        columns: 3,
        fillLastRow: true,
    }, spans.map((span, key) => {

        return createElement(GridItem, {
            span,
            key,
        });
    })));
    const renderedSpans = Array.from(html.matchAll(/--gridui-span:span (\d+) \/ span \d+/g), result => {

        return Number(result[1]);
    });

    deepStrictEqual(renderedSpans, [
        1,
        1,
        1,
        3,
        3,
        1,
        2,
    ]);
});

void test("responsive columns inherit the nearest configured breakpoint", () => {

    const medium = renderToStaticMarkup(createElement(Grid, {
        columns: {
            base: 1,
            md: 2,
        },
    }));
    const large = renderToStaticMarkup(createElement(Grid, {
        columns: {
            base: 1,
            lg: 3,
        },
    }));

    match(medium, /--gridui-columns:1;--gridui-columns-md:2;--gridui-columns-lg:2/);
    match(large, /--gridui-columns:1;--gridui-columns-md:1;--gridui-columns-lg:3/);
});

void test("content tracks shrink beside automatic action tracks", () => {

    const html = renderToStaticMarkup(createElement(Grid, {
        columns: [
            "1fr",
            "auto",
        ],
    }));

    match(html, /--gridui-grid-template:minmax\(0, 1fr\) auto/);
});

void test("invalid spans fail before rendering an unusable layout", () => {

    for (const span of [
        3,
        0,
    ] as const) {
        throws(() => {

            // Deliberately cross the type boundary to verify runtime rejection of invalid input.
            return renderToStaticMarkup(createElement(Grid, {
                columns: 2,
                fillLastRow: true,
            }, createElement(GridItem, { span: span as Span })));
        }, RangeError);
    }
});
