/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Credentials
 * @description Credential persistence, safe failures, live resolution and probe races
 */

import { ApiKeyService } from "../../../../src/main/credentials/api-key-service";
import { credentialFiles } from "../../../../src/main/credentials/credential-file";
import type { CredentialCipher } from "../../../../src/main/credentials/system-credential-cipher";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function setup(request: typeof fetch = async () => {

    return new Response(null, { status: 200 });
}) {

    const directory = mkdtempSync(join(tmpdir(), "avesd-keys-"));
    const secret = randomBytes(32);
    let available = true;
    let changes = 0;
    const cipher: CredentialCipher = {
        available: () => {

            return available;
        },
        encrypt: key => {

            const iv = randomBytes(12);
            const encoder = createCipheriv("aes-256-gcm", secret, iv);
            const content = Buffer.concat([
                encoder.update(key, "utf8"),
                encoder.final(),
            ]);

            return Buffer.concat([
                iv,
                encoder.getAuthTag(),
                content,
            ]);
        },
        decrypt: encrypted => {

            const decoder = createDecipheriv("aes-256-gcm", secret, encrypted.subarray(0, 12));
            decoder.setAuthTag(encrypted.subarray(12, 28));

            return Buffer.concat([
                decoder.update(encrypted.subarray(28)),
                decoder.final(),
            ]).toString("utf8");
        },
    };
    const files = credentialFiles(directory);
    const service = new ApiKeyService(files, cipher, () => {

        changes += 1;
    }, request);

    return {
        directory,
        service,
        files,
        cipher,
        lock: () => {

            available = false;
        },
        changes: () => {

            return changes;
        },
        close: () => {

            rmSync(directory, {
                recursive: true,
                force: true,
            });
        },
    };
}
const authorize = () => {
};

void test("save, replace and delete use ciphertext, live reads and write-only status", () => {

    const value = setup();
    try {
        assert.equal(value.service.key("deepseek"), undefined);
        value.service.save("deepseek", "synthetic-first-key", 0, authorize);
        const stored = readFileSync(join(value.directory, "deepseek.enc"));
        assert.equal(stored.includes("synthetic-first-key"), false);
        assert.equal(statSync(join(value.directory, "deepseek.enc")).mode & 0o777, 0o600);
        assert.equal(value.service.key("deepseek"), "synthetic-first-key");
        assert.equal(JSON.stringify(value.service.snapshot()).includes("synthetic-first-key"), false);
        assert.deepEqual(readdirSync(value.directory), ["deepseek.enc"]);

        const reopened = new ApiKeyService(value.files, value.cipher, authorize);
        assert.equal(reopened.key("deepseek"), "synthetic-first-key");
        value.service.save("deepseek", "synthetic-replacement", 1, authorize);
        assert.equal(value.service.key("deepseek"), "synthetic-replacement");
        assert.equal(reopened.key("deepseek"), "synthetic-replacement");
        assert.throws(() => {

            value.service.remove("deepseek", 1, authorize);
        }, { code: IpcErrorCode.VersionConflict });
        value.service.remove("deepseek", 2, authorize);
        assert.equal(value.service.key("deepseek"), undefined);
        assert.equal(reopened.key("deepseek"), undefined);
        assert.equal(value.service.status("deepseek").source, "missing");
        assert.equal(value.changes(), 3);
    } finally {
        value.close();
    }
});

void test("locked storage and write failures preserve saved keys; corrupt keys can be removed", () => {

    const value = setup();
    try {
        value.service.save("openai", "synthetic-old-key", 0, authorize);
        const failing = new ApiKeyService({
            ...value.files,
            write: () => {

                throw new Error("synthetic-sensitive-error");
            },
        }, value.cipher, authorize);
        assert.throws(() => {

            failing.save("openai", "synthetic-new-key", 0, authorize);
        }, /previous key was retained/);
        assert.equal(value.service.key("openai"), "synthetic-old-key");
        assert.equal(failing.status("openai").revision, 0);
        value.lock();
        assert.equal(value.service.snapshot().secureStorageAvailable, false);
        assert.equal(value.service.status("openai").source, "unavailable");
        assert.throws(() => {

            value.service.save("openai", "synthetic-new-key", 1, authorize);
        }, /No key was saved/);
        writeFileSync(join(value.directory, "openai.enc"), "synthetic-corruption");
        value.service.remove("openai", 1, authorize);
        assert.equal(value.service.status("openai").source, "missing");
        assert.equal(value.changes(), 2);
    } finally {
        value.close();
    }
});

void test("connection tests use current keys and expose only safe status messages", async () => {

    const headers: string[] = [];
    const value = setup(async (url, init) => {

        assert.equal(url, "https://api.openai.com/v1/models");
        assert.equal(init?.redirect, "error");
        headers.push(new Headers(init.headers).get("Authorization") ?? "");

        return new Response("synthetic-sensitive-provider-body", { status: 401 });
    });
    try {
        await assert.rejects(value.service.test("openai", 0, authorize), /Save an API key/);
        assert.equal(headers.length, 0);
        value.service.save("openai", "synthetic-first", 0, authorize);
        const result = await value.service.test("openai", 1, authorize);
        assert.equal(result.ok, false);
        assert.equal(JSON.stringify(result).includes("synthetic"), false);
        value.service.save("openai", "synthetic-next", 1, authorize);
        await value.service.test("openai", 2, authorize);
        assert.deepEqual(headers, [
            "Bearer synthetic-first",
            "Bearer synthetic-next",
        ]);
    } finally {
        value.close();
    }
});

void test("replacement aborts an in-flight probe and revoked settings windows cannot receive success", async () => {

    let finish: (response: Response) => void = () => {
    };
    let signal: AbortSignal | undefined;
    const value = setup((_url, init) => {

        signal = init?.signal ?? undefined;

        return new Promise<Response>(resolve => {

            finish = resolve;
        });
    });
    try {
        value.service.save("deepseek", "synthetic-first", 0, authorize);
        const first = value.service.test("deepseek", 1, authorize);
        await assert.rejects(value.service.test("deepseek", 1, authorize), { code: IpcErrorCode.Busy });
        value.service.save("deepseek", "synthetic-next", 1, authorize);
        assert.equal(signal?.aborted, true);
        finish(new Response(null, { status: 200 }));
        await assert.rejects(first, { code: IpcErrorCode.VersionConflict });
        let allowed = true;
        const next = value.service.test("deepseek", 2, () => {

            if (!allowed) {
                throw new OperationError(IpcErrorCode.PermissionDenied, "Settings window closed.");
            }
        });
        allowed = false;
        finish(new Response(null, { status: 200 }));
        await assert.rejects(next, { code: IpcErrorCode.PermissionDenied });
    } finally {
        value.close();
    }
});
