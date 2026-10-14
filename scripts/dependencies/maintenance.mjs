/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies
 * @description Maintenance
 */

import { updateSelf } from "./package-manager.mjs";
import { run } from "./process.mjs";
import { sortFiles } from "./sorting.mjs";
import { updateActions, updateDependencies } from "./updates.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const main = async (mode, dryRun, commands = {
    run,
    sortFiles,
    updateActions,
    updateDependencies,
    updateSelf,
}) => {

    switch (mode) {
        case "update-dependencies":
            await commands.updateDependencies(dryRun);
            break;
        case "update-actions":
            await commands.updateActions(dryRun);
            break;
        case "update-all":
            await commands.updateDependencies(dryRun);
            await commands.updateActions(dryRun);
            if (!dryRun) {
                commands.run("pnpm", ["dedupe"]);
            }
            break;
        case "update-self":
            await commands.updateSelf(dryRun);
            break;
        case "iud":
        case "ud":
            if (dryRun) {
                console.log(mode === "iud" ? "Would run: pnpm install; pnpm update -r; pnpm dedupe; update-self" : "Would run: pnpm update -r; pnpm dedupe");
            } else {
                if (mode === "iud") {
                    commands.run("pnpm", ["install"]);
                }
                commands.run("pnpm", [
                    "update",
                    "-r",
                ]);
                commands.run("pnpm", ["dedupe"]);
            }
            if (mode === "iud") {
                await commands.updateSelf(dryRun);
            }
            break;
        case "sort-dependencies":
        case "sort-workspace":
            commands.sortFiles(mode, dryRun);
            break;
        case "sort-all":
            commands.sortFiles("sort-dependencies", dryRun);
            commands.sortFiles("sort-workspace", dryRun);
            break;
        default:
            throw new Error(`Unknown maintenance command: ${mode}`);
    }
    if (dryRun) {
        console.log("Dry run complete; no repository files were changed.");
    }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [
        mode,
        ...options
    ] = process.argv.slice(2);
    if (options.some((option) => {

        return option !== "--dry-run";
    })) {
        throw new Error("Only --dry-run is supported");
    }
    await main(mode, options.includes("--dry-run"));
}
