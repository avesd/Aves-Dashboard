/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Credentials
 * @description Write-only credential settings with live resolution and revision-bound probes
 */

import type { CredentialFiles } from "./credential-file";
import type { CredentialCipher } from "./system-credential-cipher";
import { apiKeyValueSchema } from "@avesd/desktop-contracts/ipc-commands";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { ApiKeyProvider, ApiKeySnapshot, ApiKeyStatus, ApiKeyTestResult } from "@avesd/desktop-contracts/settings";
import { API_KEY_PROVIDERS } from "@avesd/desktop-contracts/settings";

const endpoints: Record<ApiKeyProvider, string> = {
    deepseek: "https://api.deepseek.com/models",
    openai: "https://api.openai.com/v1/models",
};

export class ApiKeyService {
    readonly #revisions: Record<ApiKeyProvider, number> = {
        deepseek: 0,
        openai: 0,
    };
    readonly #tests = new Map<ApiKeyProvider, AbortController>();
    constructor(
        private readonly files: CredentialFiles,
        private readonly cipher: CredentialCipher,
        private readonly changed: () => void,
        private readonly request: typeof fetch = fetch,
    ) {}

    #available(): boolean {

        try {
            return this.cipher.available();
        } catch {
            return false;
        }
    }
    key(id: ApiKeyProvider): string | undefined {

        try {
            const encrypted = this.files.read(id);
            if (!encrypted) {
                return undefined;
            }
            if (!this.#available()) {
                throw new Error("Secure storage unavailable.");
            }

            return apiKeyValueSchema.parse(this.cipher.decrypt(encrypted));
        } catch {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "The saved API key could not be read. Unlock system secure storage or replace the key in Settings.");
        }
    }
    status(id: ApiKeyProvider): ApiKeyStatus {

        let hasSavedKey = false;
        try {
            hasSavedKey = this.files.read(id) !== undefined;
            const configured = !!this.key(id);

            return {
                id,
                revision: this.#revisions[id],
                hasSavedKey,
                source: configured ? "saved" : "missing",
            };
        } catch {
            return {
                id,
                revision: this.#revisions[id],
                hasSavedKey,
                source: "unavailable",
                message: "Saved credential unavailable. Check system secure storage or replace the saved key.",
            };
        }
    }
    snapshot(): ApiKeySnapshot {

        return {
            secureStorageAvailable: this.#available(),
            providers: API_KEY_PROVIDERS.map(id => {

                return this.status(id);
            }),
        };
    }
    #check(id: ApiKeyProvider, revision: number, authorize: () => void): void {

        authorize();
        if (revision !== this.#revisions[id]) {
            throw new OperationError(IpcErrorCode.VersionConflict, "API key configuration changed. Refresh and try again.", this.#revisions[id]);
        }
    }
    #updated(id: ApiKeyProvider): void {

        this.#revisions[id] += 1;
        this.#tests.get(id)?.abort();
        this.changed();
    }
    save(id: ApiKeyProvider, input: string, revision: number, authorize: () => void): void {

        this.#check(id, revision, authorize);
        const key = apiKeyValueSchema.parse(input);
        if (!this.#available()) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "System secure storage is unavailable. No key was saved.");
        }
        try {
            const encrypted = this.cipher.encrypt(key);
            this.#check(id, revision, authorize);
            this.files.write(id, encrypted);
        } catch (error) {
            if (error instanceof OperationError) {
                throw error;
            }
            throw new OperationError(IpcErrorCode.Internal, "The API key could not be saved securely. The previous key was retained.");
        }
        this.#updated(id);
    }
    remove(id: ApiKeyProvider, revision: number, authorize: () => void): void {

        this.#check(id, revision, authorize);
        try {
            this.files.remove(id);
        } catch {
            throw new OperationError(IpcErrorCode.Internal, "The saved API key could not be deleted. Try again.");
        }
        this.#updated(id);
    }
    async test(id: ApiKeyProvider, revision: number, authorize: () => void): Promise<ApiKeyTestResult> {

        this.#check(id, revision, authorize);
        const key = this.key(id);
        if (!key) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Save an API key before testing the connection.");
        }
        if (this.#tests.has(id)) {
            throw new OperationError(IpcErrorCode.Busy, "A connection test is already running.");
        }
        const abort = new AbortController();
        this.#tests.set(id, abort);
        try {
            const response = await this.request(endpoints[id], {
                headers: { Authorization: `Bearer ${key}` },
                redirect: "error",
                signal: AbortSignal.any([
                    abort.signal,
                    AbortSignal.timeout(10000),
                ]),
            });
            await response.body?.cancel();
            this.#check(id, revision, authorize);
            if (response.ok) {
                return {
                    ok: true,
                    message: "Authentication and network access verified. Model, voice access and quota are not verified by this check.",
                };
            }
            const messages: Record<number, string> = {
                401: "Authentication failed. Replace the API key and try again.",
                403: "Access denied. Check the key's permissions with the provider.",
                429: "The provider rejected the request due to rate or quota limits.",
            };

            return {
                ok: false,
                message: messages[response.status] ?? `Connection failed (HTTP ${response.status}). Try again later.`,
            };
        } catch (error) {
            this.#check(id, revision, authorize);
            if (error instanceof OperationError) {
                throw error;
            }

            return {
                ok: false,
                message: "Connection failed or timed out. Check your network and provider availability.",
            };
        } finally {
            this.#tests.delete(id);
        }
    }
}
