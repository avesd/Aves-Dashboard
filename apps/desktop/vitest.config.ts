/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Vitest Config
 */

import { createVitestConfig } from "@avesd/configuration/vitest";
import { playwright } from "@vitest/browser-playwright";

export default createVitestConfig({
    test: {
        // Keep explicit test groups independent of Vitest 5 root-config inheritance.
        projects: [
            {
                extends: false,
                test: {
                    environment: "node",
                    exclude: ["test/**/*.browser.test.{ts,tsx}"],
                    include: ["test/unit/**/*.test.{ts,tsx}"],
                    name: "unit",
                },
            },
            {
                extends: false,
                test: {
                    environment: "node",
                    include: ["test/integration/**/*.test.{ts,tsx}"],
                    name: "integration",
                },
            },
            {
                extends: false,
                test: {
                    browser: {
                        enabled: true,
                        headless: true,
                        instances: [{ browser: "chromium" }],
                        provider: playwright(),
                    },
                    include: ["test/unit/**/*.browser.test.{ts,tsx}"],
                    name: "browser",
                },
            },
        ],
    },
});
