/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Electron Vite Config
 */

import { sandboxPlugin } from "./build/sandbox-plugin.mjs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
    main: {
        plugins: [sandboxPlugin()],
        build: {
            externalizeDeps: {
                exclude: [
                    "@avesd/workspace-model",
                    "@avesd/renderer-settings",
                    "@avesd/desktop-contracts",
                    "@modelcontextprotocol/server",
                ],
            },
            rollupOptions: {
                external: ["electron"],
                input: {
                    index: "src/main/main.ts",
                    "workspace-mcp": "src/main/agent/workspace-mcp.ts",
                },
            },
        },
    },
    preload: {
        build: {
            externalizeDeps: false,
            isolatedEntries: true,
            rollupOptions: {
                external: ["electron"],
                input: {
                    index: "src/preload/preload.ts",
                    settings: "src/preload/settings.ts",
                    "local-widget": "src/preload/local-widget.ts",
                },
                output: {
                    entryFileNames: "[name].cjs",
                    format: "cjs",
                },
            },
        },
    },
    renderer: {
        root: "src/renderer",
        plugins: [
            react(),
            tailwindcss(),
        ],
        build: {
            rollupOptions: {
                input: {
                    canvas: "src/renderer/canvas.html",
                    settings: "src/renderer/settings.html",
                    controller: "src/renderer/controller.html",
                },
            },
        },
    },
});
