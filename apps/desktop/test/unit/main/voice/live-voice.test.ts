/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Voice
 * @description Voice setup preserves typed failures and sanitizes unknown request errors
 */

import type { AgentSessions } from "../../../../src/main/agent/sessions/agent-sessions";
import { LiveVoice } from "../../../../src/main/voice/live-voice";
import { deferred } from "../../../helpers/deferred";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("ending voice during credential resolution prevents late network setup and releases admission", async () => {

    const key = deferred<string>();
    let requests = 0;
    const sessions = {
        read: () => {

            return {
                kind: "interactive",
                status: "idle",
            };
        },
    } as unknown as AgentSessions;
    const voice = new LiveVoice(sessions, () => {
    }, () => {

        return key.promise;
    }, async () => {

        requests++;

        throw new Error("No request expected for a closed connection.");
    });
    const pending = voice.start("pending", "agent", "synthetic-sdp");

    await assert.rejects(voice.start("overlap", "agent", "synthetic-sdp"), { code: IpcErrorCode.Busy });
    voice.stop("pending");
    key.resolve("synthetic-key");

    await assert.rejects(pending, { code: IpcErrorCode.ServiceNotReady });
    assert.equal(requests, 0);
});

void test("voice failure handling trusts operational errors rather than message prefixes", async () => {

    // Failed setup only reads the chosen session; no turn or provider execution is started.
    const sessions = {
        read: () => {

            return {
                kind: "interactive",
                status: "idle",
            };
        },
    } as unknown as AgentSessions;
    const safe = new OperationError(IpcErrorCode.ServiceNotReady, "Synthetic safe failure after wording changed.");
    const typed = new LiveVoice(sessions, () => {
    }, () => {

        return "synthetic-key";
    }, async () => {

        throw safe;
    });
    const unknown = new LiveVoice(sessions, () => {
    }, () => {

        return "synthetic-key";
    }, async () => {

        throw new Error("GPT-Live connection failed: synthetic private provider detail");
    });

    await assert.rejects(typed.start("typed", "agent", "synthetic-sdp"), error => {

        return error === safe;
    });
    await assert.rejects(unknown.start("unknown", "agent", "synthetic-sdp"), error => {

        assert.ok(error instanceof OperationError);
        assert.equal(error.code, IpcErrorCode.ServiceNotReady);
        assert.equal(error.message.includes("private"), false);

        return true;
    });
});
