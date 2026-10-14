/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies
 * @description Sorting
 */

import { repositoryRoot } from "./process.mjs";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isMap, isSeq, parseDocument } from "yaml";

const dependencyFields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];

export const sortManifest = (raw) => {

    const manifest = JSON.parse(raw);
    for (const field of dependencyFields) {
        if (manifest[field]) {
            manifest[field] = Object.fromEntries(Object.entries(manifest[field]).sort(([a], [b]) => {

                return a.localeCompare(b, "en");
            }));
        }
    }

    return `${JSON.stringify(manifest, null, 2)}\n`;
};

export const sortWorkspace = (raw) => {

    const document = parseDocument(raw);
    if (document.errors.length) {
        throw document.errors[0];
    }
    for (const key of [
        "catalog",
        "allowBuilds",
        "packages",
    ]) {
        const node = document.get(key, true);
        if (isMap(node)) {
            node.items.sort((a, b) => {

                return String(a.key.value).localeCompare(String(b.key.value), "en");
            });
        }
        if (isSeq(node)) {
            node.items.sort((a, b) => {

                return String(a.value).localeCompare(String(b.value), "en");
            });
        }
    }

    return String(document);
};

export const sortFiles = (mode, dryRun) => {

    let files = [join(repositoryRoot, "pnpm-workspace.yaml")];
    if (mode === "sort-dependencies") {
        files = [join(repositoryRoot, "package.json")];
        files.push(...[
            "apps",
            "packages",
        ].flatMap((parent) => {

            return readdirSync(join(repositoryRoot, parent), { withFileTypes: true }).filter((entry) => {

                return entry.isDirectory();
            })
                .map((entry) => {

                    return join(repositoryRoot, parent, entry.name, "package.json");
                });
        }));
    }
    for (const file of files) {
        const raw = readFileSync(file, "utf8");
        const sorted = mode === "sort-dependencies" ? sortManifest(raw) : sortWorkspace(raw);
        if (raw === sorted) {
            continue;
        }
        console.log(`${dryRun ? "Would sort" : "Sorting"}: ${file}`);
        if (!dryRun) {
            writeFileSync(file, sorted);
        }
    }
};
