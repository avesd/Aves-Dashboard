/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies
 * @description Updates
 */

import { repositoryRoot, run } from "./process.mjs";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";

export const parseOutdated = (result) => {

    if (result.error) {
        throw result.error;
    }
    if (![
        0,
        1,
    ].includes(result.status)) {
        throw new Error(result.stderr || "pnpm outdated failed");
    }
    const data = JSON.parse(result.stdout);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("pnpm outdated must return an object");
    }
    for (const [
        name,
        entry,
    ] of Object.entries(data)) {
        if (!entry || typeof entry.latest !== "string") {
            throw new Error(`Missing latest version for ${name}`);
        }
    }

    return data;
};

const outdated = (includeActions) => {

    const args = [
        "--silent",
        "outdated",
        "-r",
        "--format",
        "json",
    ];
    if (includeActions) {
        args.push("--include-github-actions");
    }

    return parseOutdated(spawnSync("pnpm", args, {
        cwd: repositoryRoot,
        encoding: "utf8",
    }));
};

export const selectUpdates = (data, actions) => {

    return Object.entries(data).filter(([
        , entry,
    ]) => {

        return (entry.dependencyType === "githubAction") === actions;
    });
};

export const updateDependencies = async (dryRun) => {

    if (!dryRun) {
        run("pnpm", [
            "update",
            "-r",
            "--latest",
        ]);

        return;
    }
    const workspace = parseDocument(readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8")).toJS();
    const ignored = workspace.updateConfig?.ignoreDependencies ?? [];
    const updates = selectUpdates(outdated(false), false).filter(([name]) => {

        return !ignored.includes(name);
    });
    for (const name of ignored) {
        console.log(`Excluded by update policy: ${name}`);
    }
    for (const [
        name,
        entry,
    ] of updates) {
        console.log(`${name}: ${entry.current} -> ${entry.latest}`);
    }
    if (!updates.length) {
        console.log("All package dependencies are current.");
    }
};

export const updateActions = async (dryRun) => {

    const updates = selectUpdates(outdated(true), true);
    for (const [
        name,
        entry,
    ] of updates) {
        console.log(`${name}: ${entry.current} -> ${entry.latest}`);
    }
    if (!updates.length) {
        console.log("All GitHub Actions are current.");

        return;
    }
    if (!dryRun) {
        run("pnpm", [
            "update",
            "-r",
            ...updates.map(([name]) => {

                return name;
            }),
            "--latest",
            "--include-github-actions",
        ]);
    }
};
