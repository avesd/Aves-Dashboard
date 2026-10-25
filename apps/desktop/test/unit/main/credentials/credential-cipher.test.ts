/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Credentials
 * @description Async secure-storage formats reject Linux fallback and unknown backends
 */

import { createCredentialCipher } from "../../../../src/main/credentials/credential-cipher";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("Linux requires a supported secret-provider format for availability, writes and reads", async () => {

    for (const tag of [
        "v10",
        "v11",
        "v12",
        "v99",
        "",
    ]) {
        let decryptions = 0;
        const storage = {
            isAsyncEncryptionAvailable: async () => {

                return true;
            },
            encryptStringAsync: async () => {

                return Buffer.from(`${tag}synthetic-ciphertext`);
            },
            decryptStringAsync: async () => {

                decryptions++;

                return {
                    result: "synthetic-key",
                    shouldReEncrypt: false,
                };
            },
        };
        const cipher = createCredentialCipher(storage, "linux");
        const encrypted = Buffer.from(`${tag}synthetic-ciphertext`);

        if (tag === "v11" || tag === "v12") {
            assert.equal(await cipher.available(), true);
            assert.deepEqual(await cipher.encrypt("synthetic-key"), encrypted);
            assert.equal(await cipher.decrypt(encrypted), "synthetic-key");
            assert.equal(decryptions, 1);
        } else {
            assert.equal(await cipher.available(), false);
            await assert.rejects(cipher.encrypt("synthetic-key"));
            await assert.rejects(cipher.decrypt(encrypted));
            assert.equal(decryptions, 0);
        }
    }
});

void test("a Linux backend falling back after availability cannot write credentials", async () => {

    let tag = "v11";
    const cipher = createCredentialCipher({
        isAsyncEncryptionAvailable: async () => {

            return true;
        },
        encryptStringAsync: async () => {

            return Buffer.from(`${tag}synthetic-ciphertext`);
        },
        decryptStringAsync: async () => {

            throw new Error("No decryption expected.");
        },
    }, "linux");

    assert.equal(await cipher.available(), true);
    tag = "v10";

    await assert.rejects(cipher.encrypt("synthetic-key"));
});

void test("macOS and Windows preserve legacy ciphertext reads without implicit rotation writes", async () => {

    for (const platform of [
        "darwin",
        "win32",
    ] as const) {
        const cipher = createCredentialCipher({
            isAsyncEncryptionAvailable: async () => {

                return true;
            },
            encryptStringAsync: async () => {

                throw new Error("A read must not rewrite a credential.");
            },
            decryptStringAsync: async encrypted => {

                assert.equal(encrypted.toString(), "v10synthetic-legacy-ciphertext");

                return {
                    result: "synthetic-key",
                    shouldReEncrypt: true,
                };
            },
        }, platform);

        assert.equal(await cipher.available(), true);
        assert.equal(await cipher.decrypt(Buffer.from("v10synthetic-legacy-ciphertext")), "synthetic-key");
    }
});
