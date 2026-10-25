/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Credentials
 * @description Credential persistence, safe failures, live resolution and probe races
 */

import { ApiKeyService } from "../../../../src/main/credentials/api-key-service";
import type { CredentialCipher } from "../../../../src/main/credentials/credential-cipher";
import { credentialFiles } from "../../../../src/main/credentials/credential-file";
import { deferred } from "../../../helpers/deferred";
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
        available: async () => {

            return available;
        },
        encrypt: async key => {

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
        decrypt: async encrypted => {

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

void test("revoked and stale asynchronous saves retain the last committed key", async () => {

    const value = setup();
    try {
        await value.service.save("deepseek", "synthetic-original", 0, authorize);
        const encrypt = value.cipher.encrypt;
        let entered = deferred<void>();
        let resume = deferred<void>();
        value.cipher.encrypt = async key => {

            const encrypted = await encrypt(key);
            if (key === "synthetic-pending") {
                entered.resolve();
                await resume.promise;
            }

            return encrypted;
        };
        let allowed = true;
        const pending = value.service.save("deepseek", "synthetic-pending", 1, () => {

            if (!allowed) {
                throw new OperationError(IpcErrorCode.PermissionDenied, "Synthetic window closed.");
            }
        });
        await entered.promise;

        allowed = false;
        resume.resolve();

        await assert.rejects(pending, { code: IpcErrorCode.PermissionDenied });
        assert.equal(await value.service.key("deepseek"), "synthetic-original");
        assert.equal(value.changes(), 1);

        entered = deferred<void>();
        resume = deferred<void>();
        const stale = value.service.save("deepseek", "synthetic-pending", 1, authorize);
        await entered.promise;

        await value.service.save("deepseek", "synthetic-winner", 1, authorize);
        resume.resolve();

        await assert.rejects(stale, { code: IpcErrorCode.VersionConflict });
        assert.equal(await value.service.key("deepseek"), "synthetic-winner");
        assert.equal(value.changes(), 2);
    } finally {
        value.close();
    }
});

void test("pending decryption cannot revive deleted or externally replaced keys", async () => {

    for (const change of [
        "remove",
        "replace",
    ] as const) {
        const value = setup();
        try {
            await value.service.save("deepseek", "synthetic-original", 0, authorize);
            const decrypt = value.cipher.decrypt;
            const entered = deferred<void>();
            const resume = deferred<void>();
            value.cipher.decrypt = async encrypted => {

                const key = await decrypt(encrypted);
                entered.resolve();
                await resume.promise;

                return key;
            };
            const pending = value.service.key("deepseek");
            await entered.promise;

            if (change === "remove") {
                value.service.remove("deepseek", 1, authorize);
            } else {
                const other = new ApiKeyService(value.files, value.cipher, authorize);
                await other.save("deepseek", "synthetic-replacement", 0, authorize);
            }
            resume.resolve();

            await assert.rejects(pending, { code: IpcErrorCode.ServiceNotReady });
        } finally {
            value.close();
        }
    }
});

void test("credential probes reserve admission before decryption and recheck authorization before network access", async () => {

    let requests = 0;
    const value = setup(async () => {

        requests++;

        return new Response(null, { status: 200 });
    });
    try {
        await value.service.save("openai", "synthetic-key", 0, authorize);
        const decrypt = value.cipher.decrypt;
        const entered = deferred<void>();
        const resume = deferred<void>();
        value.cipher.decrypt = async encrypted => {

            entered.resolve();
            await resume.promise;

            return decrypt(encrypted);
        };
        let allowed = true;
        const pending = value.service.test("openai", 1, () => {

            if (!allowed) {
                throw new OperationError(IpcErrorCode.PermissionDenied, "Synthetic window closed.");
            }
        });
        await entered.promise;

        await assert.rejects(value.service.test("openai", 1, authorize), { code: IpcErrorCode.Busy });
        allowed = false;
        resume.resolve();

        await assert.rejects(pending, { code: IpcErrorCode.PermissionDenied });
        assert.equal(requests, 0);
    } finally {
        value.close();
    }
});

void test("save, replace and delete use ciphertext, live reads and write-only status", async () => {

    const value = setup();
    try {
        assert.equal(await value.service.key("deepseek"), undefined);
        await value.service.save("deepseek", "synthetic-first-key", 0, authorize);
        const stored = readFileSync(join(value.directory, "deepseek.enc"));
        assert.equal(stored.includes("synthetic-first-key"), false);
        assert.equal(statSync(join(value.directory, "deepseek.enc")).mode & 0o777, 0o600);
        assert.equal(await value.service.key("deepseek"), "synthetic-first-key");
        assert.equal(JSON.stringify(await value.service.snapshot()).includes("synthetic-first-key"), false);
        assert.deepEqual(readdirSync(value.directory), ["deepseek.enc"]);

        const reopened = new ApiKeyService(value.files, value.cipher, authorize);
        assert.equal(await reopened.key("deepseek"), "synthetic-first-key");
        await value.service.save("deepseek", "synthetic-replacement", 1, authorize);
        assert.equal(await value.service.key("deepseek"), "synthetic-replacement");
        assert.equal(await reopened.key("deepseek"), "synthetic-replacement");
        assert.throws(() => {

            value.service.remove("deepseek", 1, authorize);
        }, { code: IpcErrorCode.VersionConflict });
        value.service.remove("deepseek", 2, authorize);
        assert.equal(await value.service.key("deepseek"), undefined);
        assert.equal(await reopened.key("deepseek"), undefined);
        assert.equal((await value.service.status("deepseek")).source, "missing");
        assert.equal(value.changes(), 3);
    } finally {
        value.close();
    }
});

void test("locked storage and write failures preserve saved keys; corrupt keys can be removed", async () => {

    const value = setup();
    try {
        await value.service.save("openai", "synthetic-old-key", 0, authorize);
        const failing = new ApiKeyService({
            ...value.files,
            write: () => {

                throw new Error("synthetic-sensitive-error");
            },
        }, value.cipher, authorize);
        await assert.rejects(failing.save("openai", "synthetic-new-key", 0, authorize), /previous key was retained/);
        assert.equal(await value.service.key("openai"), "synthetic-old-key");
        assert.equal((await failing.status("openai")).revision, 0);
        value.lock();
        assert.equal((await value.service.snapshot()).secureStorageAvailable, false);
        assert.equal((await value.service.status("openai")).source, "unavailable");
        await assert.rejects(value.service.save("openai", "synthetic-new-key", 1, authorize), /No key was saved/);
        writeFileSync(join(value.directory, "openai.enc"), "synthetic-corruption");
        value.service.remove("openai", 1, authorize);
        assert.equal((await value.service.status("openai")).source, "missing");
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
        await value.service.save("openai", "synthetic-first", 0, authorize);
        const result = await value.service.test("openai", 1, authorize);
        assert.equal(result.ok, false);
        assert.equal(JSON.stringify(result).includes("synthetic"), false);
        await value.service.save("openai", "synthetic-next", 1, authorize);
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
        await value.service.save("deepseek", "synthetic-first", 0, authorize);
        const first = value.service.test("deepseek", 1, authorize);
        await assert.rejects(value.service.test("deepseek", 1, authorize), { code: IpcErrorCode.Busy });
        await value.service.save("deepseek", "synthetic-next", 1, authorize);
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
