/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Main
 */

import { startDesktop } from "./desktop-application";
import { loadEnvironment } from "./environment/load-environment";
import { app } from "electron";
import { resolve } from "node:path";

loadEnvironment(process.env.AVESD_ENV_DIR ?? (app.isPackaged ? resolve(app.getPath("userData"), "env") : resolve(__dirname, "../../../../env")), app.isPackaged ? "production" : "development");

export const desktopReady = startDesktop();
