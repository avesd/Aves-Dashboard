/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_IPC
 * @description IPC Result.test
 */

import { captureIpcResult, handleWindow } from "../../../../src/main/ipc/ipc-result";
import { canvasFailure } from "../../../../src/main/operation-failure";
import { createWindowClient, IpcError, IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";

void test("operational codes and revision survive serialization and renderer unwrapping", async () => {

    for (const code of Object.values(IpcErrorCode)) {
        const wire = structuredClone(await captureIpcResult(() => {

            throw new OperationError(code, "Safe failure", 7);
        }));
        const client = createWindowClient<{
            run: () => Promise<void>;
        }>({
            run: async () => {

                return wire;
            },
        });
        await assert.rejects(client.run(), (error: unknown) => {

            assert.ok(error instanceof IpcError);
            assert.equal(error.code, code);
            assert.equal(error.currentRevision, 7);

            return true;
        });
    }
});

void test("validation and unexpected failures do not disclose input or internal details", async () => {

    const invalid = await captureIpcResult(() => {

        return z.literal("valid").parse("synthetic-private-input");
    });
    assert.deepEqual(invalid, {
        ok: false,
        error: {
            code: IpcErrorCode.InvalidArgument,
            message: "Invalid request parameters.",
        },
    });
    const internal = await captureIpcResult(() => {

        throw new Error("synthetic-private-path");
    });
    assert.deepEqual(internal, {
        ok: false,
        error: {
            code: IpcErrorCode.Internal,
            message: "The operation failed. Please try again.",
        },
    });
});

void test("canvas domain failures use the same window error codes", async () => {

    for (const code of [
        "UNAUTHENTICATED",
        "FORBIDDEN",
    ] as const) {
        assert.equal(canvasFailure({
            code,
            message: "Denied",
        }).code, IpcErrorCode.PermissionDenied);
    }
    assert.deepEqual(await captureIpcResult(() => {

        throw canvasFailure({
            code: "REVISION_CONFLICT",
            message: "Changed",
            currentRevision: 3,
        });
    }), {
        ok: false,
        error: {
            code: IpcErrorCode.VersionConflict,
            message: "Changed",
            currentRevision: 3,
        },
    });
});

void test("typed window registration wraps failures in the result envelope", async () => {

    let registered: Parameters<IpcMain["handle"]>[1] | undefined;
    handleWindow({
        handle: (channel, handler) => {

            assert.equal(channel, "dashboard-blocks:request");
            registered = handler;
        },
    }, "dashboard-blocks:request", () => {

        throw new OperationError(IpcErrorCode.PermissionDenied, "Denied");
    });
    assert.ok(registered);
    assert.deepEqual(await registered({} as IpcMainInvokeEvent), {
        ok: false,
        error: {
            code: IpcErrorCode.PermissionDenied,
            message: "Denied",
        },
    });
});
