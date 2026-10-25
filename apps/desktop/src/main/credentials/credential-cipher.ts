/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Credentials
 * @description Asynchronous credential encryption with explicit Linux backend protection
 */

export interface CredentialCipher {
    available(): Promise<boolean>;
    encrypt(key: string): Promise<Buffer>;
    decrypt(encrypted: Buffer): Promise<string>;
}

interface SecureStorage {
    isAsyncEncryptionAvailable(): Promise<boolean>;
    encryptStringAsync(value: string): Promise<Buffer>;
    decryptStringAsync(value: Buffer): Promise<{
        result: string;
        shouldReEncrypt: boolean;
    }>;
}

/** Electron 45's Chromium backend uses v11 for Secret Service and v12 for Secret Portal.
 * Its POSIX v10 fallback uses a public fixed key. Unknown formats fail closed.
 * See docs/agent-sessions.md for the versioned upstream sources.
 */
function protectedCiphertext(platform: NodeJS.Platform, encrypted: Buffer): boolean {

    if (platform !== "linux") {
        return true;
    }
    const tag = encrypted.subarray(0, 3).toString("utf8");

    return encrypted.length > 3 && (tag === "v11" || tag === "v12");
}

export function createCredentialCipher(storage: SecureStorage, platform: NodeJS.Platform): CredentialCipher {

    return {
        available: async () => {

            if (!await storage.isAsyncEncryptionAvailable()) {
                return false;
            }
            if (platform === "linux") {
                const probe = await storage.encryptStringAsync("Avesd secure storage availability");

                return protectedCiphertext(platform, probe);
            }

            return true;
        },
        encrypt: async key => {

            const encrypted = await storage.encryptStringAsync(key);
            if (!protectedCiphertext(platform, encrypted)) {
                throw new Error("Secure credential encryption is unavailable.");
            }

            return encrypted;
        },
        decrypt: async encrypted => {

            if (!protectedCiphertext(platform, encrypted)) {
                throw new Error("Unsupported credential encryption.");
            }
            const decrypted = await storage.decryptStringAsync(encrypted);

            return decrypted.result;
        },
    };
}
