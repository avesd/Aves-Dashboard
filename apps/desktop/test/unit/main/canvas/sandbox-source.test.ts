/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Canvas
 * @description Inline sandbox source handoff and script escaping
 */

import { sandboxSource } from "../../../../build/sandbox-source.mjs";
import { CANVAS_DOCUMENT_CSP, canvasDocument } from "../../../../src/main/canvas/canvas-document";
import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

void test("sandbox compilation erases types while preserving script terminators as data", () => {

    const source = sandboxSource('(() => { const value: string = "</script>"; globalThis.value = value; })();');
    const context: {
        value?: string;
    } = {};

    runInNewContext(source, context);

    assert.equal(context.value, "</script>");
    assert.equal(source.includes("</script>"), false);
});

void test("canvas host embeds the checked browser entry without changing the sandbox policy", () => {

    const html = canvasDocument();

    assert.equal(html.match(/<script>/gu)?.length, 1);
    assert.equal(html.match(/<\/script>/gu)?.length, 1);
    assert.ok(html.includes('id="world"'));
    assert.ok(CANVAS_DOCUMENT_CSP.includes("sandbox allow-scripts allow-forms"));
    assert.ok(CANVAS_DOCUMENT_CSP.includes("connect-src 'none'"));
});
