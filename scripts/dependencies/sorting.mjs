/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies
 * @description Sorting
 */

import { repositoryRoot } from "./process.mjs";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isMap, isScalar, isSeq, parseDocument, Scalar } from "yaml";

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
            for (const item of node.items) {
                if (isScalar(item.key) && typeof item.key.value === "string") {
                    item.key.type = item.key.value.startsWith("@") ? Scalar.QUOTE_DOUBLE : Scalar.PLAIN;
                }
            }
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

export const sortFiles = (mode, dryRun, root = repositoryRoot) => {

    const workspacePath = join(root, "pnpm-workspace.yaml");
    let files = [workspacePath];
    if (mode === "sort-dependencies") {
        files = [join(root, "package.json")];
        files.push(...[
            "apps",
            "packages",
        ].flatMap((parent) => {

            return readdirSync(join(root, parent), { withFileTypes: true }).filter((entry) => {

                return entry.isDirectory();
            })
                .map((entry) => {

                    return join(root, parent, entry.name, "package.json");
                });
        }));
    }
    for (const file of files) {
        const raw = readFileSync(file, "utf8");
        const sorted = file === workspacePath ? sortWorkspace(raw) : sortManifest(raw);
        if (raw === sorted) {
            continue;
        }
        console.log(`${dryRun ? "Would sort" : "Sorting"}: ${file}`);
        if (!dryRun) {
            writeFileSync(file, sorted);
        }
    }
};
