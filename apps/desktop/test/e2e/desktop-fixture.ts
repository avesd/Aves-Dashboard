/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Launch the real desktop with disposable data and no inherited credentials
 */

import type { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron, test as base } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface DesktopFixtures {
    desktop: ElectronApplication;
    controller: Page;
}

export const test = base.extend<DesktopFixtures>({
    // Playwright requires a destructured fixture argument, even without dependencies.
    // eslint-disable-next-line no-empty-pattern
    desktop: async ({}, provide) => {

        const directory = await mkdtemp(join(tmpdir(), "avesd-e2e-"));
        const env: Record<string, string> = { AVESD_E2E_DIRECTORY: directory };
        for (const key of [
            "PATH",
            "SystemRoot",
            "WINDIR",
            "TEMP",
            "TMP",
            "TMPDIR",
            "DISPLAY",
            "XAUTHORITY",
            "WAYLAND_DISPLAY",
            "XDG_RUNTIME_DIR",
        ]) {
            const value = process.env[key];
            if (value !== undefined) {
                env[key] = value;
            }
        }
        let desktop: ElectronApplication | undefined;
        try {
            desktop = await electron.launch({
                args: [join(import.meta.dirname, "bootstrap.mjs")],
                env,
            });
            await provide(desktop);
        } finally {
            try {
                await desktop?.close();
            } finally {
                await rm(directory, {
                    recursive: true,
                    force: true,
                });
            }
        }
    },
    controller: async ({ desktop }, provide) => {

        const controller = await desktop.firstWindow();
        await controller.waitForURL("**/controller.html");
        await provide(controller);
    },
});

export { expect } from "@playwright/test";
