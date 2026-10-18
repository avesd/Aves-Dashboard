/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Credentials
 * @description OS-backed encryption that rejects Linux plaintext fallback
 */

import { safeStorage } from "electron";

export interface CredentialCipher {
    available(): boolean;
    encrypt(key: string): Buffer;
    decrypt(encrypted: Buffer): string;
}

export const systemCredentialCipher: CredentialCipher = {
    available: () => {

        if (!safeStorage.isEncryptionAvailable()) {
            return false;
        }
        if (process.platform === "linux") {
            return [
                "gnome_libsecret",
                "kwallet",
                "kwallet5",
                "kwallet6",
            ].includes(safeStorage.getSelectedStorageBackend());
        }

        return true;
    },
    encrypt: key => {

        return safeStorage.encryptString(key);
    },
    decrypt: encrypted => {

        return safeStorage.decryptString(encrypted);
    },
};
