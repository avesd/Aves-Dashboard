/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Test_Unit_Dependencies
 * @description Verify workspace-driven manifest sorting and write-free previews
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { test } from "node:test";

// The maintenance entry point is JavaScript; type only the operation exercised here.
const { sortFiles } = createRequire(import.meta.url)("../../../dependencies/sorting.mjs") as {
    sortFiles(mode: "sort-dependencies", dryRun: boolean, root: string): void;
};

function fixture(context: TestContext) {

    const root = mkdtempSync(join(tmpdir(), "avesd-dependency-sorting-"));
    context.after(() => {

        rmSync(root, {
            recursive: true,
            force: true,
        });
    });
    const write = (path: string, content: string) => {

        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);

        return target;
    };
    write("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n  - packages-renderer/*\n  - packages-ui/*\n  - extensions/*\n");
    const raw = `${JSON.stringify({
        name: "synthetic",
        dependencies: {
            zeta: "catalog:",
            alpha: "catalog:",
        },
    })}\n`;
    const manifests = [
        "package.json",
        "apps/desktop/package.json",
        "packages/example/package.json",
        "packages-renderer/canvas/package.json",
        "packages-ui/controls/package.json",
        "extensions/extra/package.json",
    ];
    for (const path of manifests) {
        write(path, raw);
    }
    context.mock.method(console, "log", () => {
    });

    return {
        root,
        write,
        raw,
        manifests,
    };
}

void test("sorts root and declared workspace manifests without following undeclared or symlinked workspaces", context => {

    const { root, write, raw, manifests } = fixture(context);
    const excluded = write("other/excluded/package.json", raw);
    symlinkSync(join(root, "other/excluded"), join(root, "packages/linked"));

    sortFiles("sort-dependencies", false, root);

    for (const path of manifests) {
        const sorted = readFileSync(join(root, path), "utf8");
        assert.equal(sorted, `${JSON.stringify({
            name: "synthetic",
            dependencies: {
                alpha: "catalog:",
                zeta: "catalog:",
            },
        }, null, 2)}\n`);
    }
    assert.equal(readFileSync(excluded, "utf8"), raw);
});

void test("dry-run preserves every manifest and sorting again leaves the result unchanged", context => {

    const { root, raw, manifests } = fixture(context);

    sortFiles("sort-dependencies", true, root);

    for (const path of manifests) {
        assert.equal(readFileSync(join(root, path), "utf8"), raw);
    }

    sortFiles("sort-dependencies", false, root);
    const sorted = manifests.map(path => {

        return readFileSync(join(root, path), "utf8");
    });
    sortFiles("sort-dependencies", false, root);

    assert.deepEqual(manifests.map(path => {

        return readFileSync(join(root, path), "utf8");
    }), sorted);
});

void test("invalid workspace declarations fail before any manifest is changed", context => {

    const { root, write, raw } = fixture(context);
    for (const declaration of [
        "packages: [apps/*, ../external/*]\n",
        "packages: invalid\n",
        "packages: [\n",
    ]) {
        write("pnpm-workspace.yaml", declaration);

        assert.throws(() => {

            return void sortFiles("sort-dependencies", false, root);
        });

        assert.equal(readFileSync(join(root, "package.json"), "utf8"), raw);
    }
});
