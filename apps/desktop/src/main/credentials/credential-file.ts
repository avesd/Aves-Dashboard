/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Credentials
 * @description Atomic owner-only ciphertext files outside workspace data
 */

import type { ApiKeyProvider } from "@avesd/desktop-contracts/settings";
import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface CredentialFiles {
    read(id: ApiKeyProvider): Buffer | undefined;
    write(id: ApiKeyProvider, encrypted: Buffer): void;
    remove(id: ApiKeyProvider): void;
}

export function credentialFiles(directory: string): CredentialFiles {

    const path = (id: ApiKeyProvider) => {

        return join(directory, `${id}.enc`);
    };

    return {
        read: id => {

            try {
                const data = readFileSync(path(id));
                if (data.length === 0 || data.length > 16384) {
                    throw new Error("Invalid credential file.");
                }

                return data;
            } catch (error) {
                if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                    return undefined;
                }
                throw error;
            }
        },
        write: (id, encrypted) => {

            mkdirSync(directory, {
                recursive: true,
                mode: 0o700,
            });
            const temporary = join(directory, `${id}.${randomUUID()}.tmp`);
            let descriptor: number | undefined;
            try {
                descriptor = openSync(temporary, "wx", 0o600);
                writeFileSync(descriptor, encrypted);
                fsyncSync(descriptor);
                closeSync(descriptor);
                descriptor = undefined;
                renameSync(temporary, path(id));
            } finally {
                if (descriptor !== undefined) {
                    closeSync(descriptor);
                }
                rmSync(temporary, { force: true });
            }
        },
        remove: id => {

            rmSync(path(id), { force: true });
        },
    };
}
