/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Credentials
 * @description OS-backed encryption that rejects Linux plaintext fallback
 */

import { createCredentialCipher } from "./credential-cipher";
import { safeStorage } from "electron";

export const systemCredentialCipher = createCredentialCipher(safeStorage, process.platform);
