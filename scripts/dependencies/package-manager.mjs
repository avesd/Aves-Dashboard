/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies
 * @description Package Manager
 */

import { repositoryRoot, run } from "./process.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";

export const selectPnpmVersion = (metadata, minimumAgeMinutes = 0, now = Date.now()) => {

    const latest = metadata["dist-tags"]?.latest;
    if (!/^\d+\.\d+\.\d+$/.test(latest ?? "")) {
        throw new Error("pnpm latest must be a stable semantic version");
    }
    const compare = (left, right) => {

        const a = left.split(".").map(Number);
        const b = right.split(".").map(Number);

        return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    };
    const candidates = Object.keys(metadata.versions ?? {}).filter((version) => {

        const timestamp = Date.parse(metadata.time?.[version]);

        return /^\d+\.\d+\.\d+$/.test(version) && compare(version, latest) <= 0
            && Number.isFinite(timestamp) && timestamp <= now - minimumAgeMinutes * 60_000;
    })
        .sort(compare);
    if (!candidates.length) {
        throw new Error("No stable pnpm version satisfies the release-age policy");
    }

    return candidates.at(-1);
};

export const updateSelf = async (dryRun) => {

    const workspace = parseDocument(readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"));
    const age = workspace.get("minimumReleaseAge") ?? 0;
    if (!Number.isFinite(age) || age < 0) {
        throw new Error("minimumReleaseAge must be a non-negative number");
    }
    const response = await fetch("https://registry.npmjs.org/pnpm", { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
        throw new Error(`pnpm registry: HTTP ${response.status}`);
    }
    const version = selectPnpmVersion(await response.json(), age);
    const current = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")).packageManager;
    console.log(`Package manager: ${current} -> pnpm@${version}`);
    if (current.split("+")[0] === `pnpm@${version}` || dryRun) {
        return;
    }
    run("corepack", [
        "use",
        `pnpm@${version}`,
    ]);
};
