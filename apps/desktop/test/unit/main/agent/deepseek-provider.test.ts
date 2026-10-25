/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Agent
 * @description Local provider readiness and retained installation compatibility
 */

import { deepSeekAvailability, deepSeekProviders } from "../../../../src/main/agent/deepseek-provider";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("local provider availability reports configuration without claiming verified access", async () => {

    const configured = (await deepSeekAvailability(() => {

        return "synthetic-key";
    }))[0]!;
    const missing = (await deepSeekAvailability(() => {

        return undefined;
    }))[0]!;
    const unavailable = (await deepSeekAvailability(() => {

        throw new Error("Synthetic private storage detail");
    }))[0]!;

    assert.equal(configured.readiness, "configured");
    assert.equal(configured.kind, "api");
    assert.equal("installed" in configured, false);
    assert.equal("executablePath" in configured, false);
    assert.equal(missing.readiness, "missing");
    assert.equal(unavailable.readiness, "unavailable");
    assert.equal(JSON.stringify(unavailable).includes("private"), false);
    assert.equal((await deepSeekProviders(() => {

        return "synthetic-key";
    }))[0]!.status, "installed");
    assert.equal((await deepSeekProviders(() => {

        return undefined;
    }))[0]!.status, "not-found");
});
