/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Browser
 * @description Known collection failures preserve safe messages without trusting prose
 */

import { BrowserCollectionError, browserCollectionMessage } from "../../../../src/main/browser/browser-collection-error";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("collection classification depends on its tag rather than mutable English wording", () => {

    const error = new BrowserCollectionError("load-failed");
    error.message = "Synthetic private response content";

    assert.equal(browserCollectionMessage(error), "The page could not load. Check the connection and retry.");
    assert.equal(
        browserCollectionMessage(new Error("The page could not load: synthetic private response")),
        "Collection failed. Open the page and check its rules before retrying.",
    );
    assert.equal(browserCollectionMessage("Synthetic private response content").includes("private"), false);
});
