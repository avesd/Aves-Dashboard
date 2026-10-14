/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies_Test
 * @description Maintenance.test
 */

import { main } from "../../../../scripts/dependencies/maintenance.mjs";
import { selectPnpmVersion } from "../../../../scripts/dependencies/package-manager.mjs";
import { repositoryRoot, run } from "../../../../scripts/dependencies/process.mjs";
import { sortFiles, sortManifest, sortWorkspace } from "../../../../scripts/dependencies/sorting.mjs";
import { parseOutdated, selectUpdates } from "../../../../scripts/dependencies/updates.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse, parseDocument } from "yaml";

test("outdated accepts exit 1 for updates and rejects process or payload errors", () => {

    const data = { astro: { latest: "7.3.6" } };
    assert.deepEqual(parseOutdated({
        status: 1,
        stdout: JSON.stringify(data),
    }), data);
    assert.deepEqual(parseOutdated({
        status: 0,
        stdout: "{}",
    }), {});
    assert.throws(() => {

        return parseOutdated({
            status: 2,
            stderr: "registry unavailable",
        });
    }, /registry unavailable/);
    assert.throws(() => {

        return parseOutdated({
            status: 1,
            stdout: "[]",
        });
    }, /must return an object/);
    assert.throws(() => {

        return parseOutdated({
            status: 1,
            stdout: '{"astro":{}}',
        });
    }, /Missing latest/);
});

test("package and Actions updates select separate dependency sets", () => {

    const data = {
        astro: {
            latest: "7.3.6",
            dependencyType: "dependencies",
        },
        "actions/checkout": {
            latest: "7.0.2",
            dependencyType: "githubAction",
        },
    };
    assert.deepEqual(selectUpdates(data, false).map(([name]) => {

        return name;
    }), ["astro"]);
    assert.deepEqual(selectUpdates(data, true).map(([name]) => {

        return name;
    }), ["actions/checkout"]);
    assert.deepEqual(selectUpdates({}, true), []);
});

test("pnpm selection respects release age, numeric ordering, and the latest ceiling", () => {

    const metadata = {
        "dist-tags": { latest: "12.10.0" },
        versions: {
            "12.9.0": {},
            "12.10.0": {},
            "13.0.0": {},
            "13.0.0-beta.1": {},
        },
        time: {
            "12.9.0": "2026-09-01T00:00:00Z",
            "12.10.0": "2026-10-02T00:00:00Z",
            "13.0.0": "2026-09-01T00:00:00Z",
            "13.0.0-beta.1": "2026-09-01T00:00:00Z",
        },
    };
    const now = Date.parse("2026-10-02T12:00:00Z");
    assert.equal(selectPnpmVersion(metadata, 0, now), "12.10.0");
    assert.equal(selectPnpmVersion(metadata, 4320, now), "12.9.0");
    assert.throws(() => {

        return selectPnpmVersion(metadata, 100_000, now);
    }, /No stable pnpm/);
    assert.throws(() => {

        return selectPnpmVersion({ "dist-tags": { latest: "13.0.0-beta.1" } });
    }, /stable semantic version/);
});

test("manifest sorting changes only dependency order and is idempotent", () => {

    const original = {
        name: "@avesd/example",
        scripts: { dev: "astro dev" },
        dependencies: {
            z: "catalog:",
            a: "workspace:*",
        },
    };
    const sorted = sortManifest(JSON.stringify(original));
    const parsed = JSON.parse(sorted);
    assert.deepEqual(Object.keys(parsed.dependencies), [
        "a",
        "z",
    ]);
    assert.deepEqual(parsed.scripts, original.scripts);
    assert.equal(sortManifest(sorted), sorted);
});

test("workspace sorting retains comments, policy, and version strings", () => {

    const original = "# workspace policy\npackages:\n  - websites/*\n  - packages/*\n\ncatalog:\n  z: 1.2.3 # keep this note\n  a: 2.0.0\n\nallowBuilds:\n  sharp: true\n  esbuild: true\n\nminimumReleaseAge: 4320\n";
    const sorted = sortWorkspace(original);
    assert.deepEqual(parse(sorted).catalog, parse(original).catalog);
    assert.deepEqual(parse(sorted).packages, [
        "packages/*",
        "websites/*",
    ]);
    assert.equal(parse(sorted).minimumReleaseAge, 4320);
    assert.match(sorted, /keep this note/);
    assert.match(sorted, /workspace policy/);
    assert.equal(sortWorkspace(sorted), sorted);
    assert.equal(parseDocument(sorted).errors.length, 0);
});

test("maintenance previews never invoke mutating commands", async () => {

    for (const mode of [
        "ud",
        "iud",
        "update-all",
        "update-dependencies",
        "update-actions",
        "update-self",
        "sort-all",
    ]) {
        const calls = [];
        const record = (name) => {

            return (...args) => {

                calls.push([
                    name,
                    ...args,
                ]);
            };
        };
        await main(mode, true, {
            run: () => {

                throw new Error("Preview attempted a mutating command");
            },
            updateDependencies: record("dependencies"),
            updateActions: record("actions"),
            updateSelf: record("self"),
            sortFiles: record("sort"),
        });
        assert.ok(calls.every((call) => {

            return call.at(-1) === true;
        }));
    }
});

test("maintenance stops immediately when a dependency update fails", async () => {

    const calls = [];
    await assert.rejects(main("update-all", false, {
        updateDependencies: () => {

            throw new Error("Update failed");
        },
        updateActions: () => {

            calls.push("actions");
        },
        run: () => {

            calls.push("dedupe");
        },
    }), /Update failed/);
    assert.deepEqual(calls, []);
    await assert.rejects(main("unknown", true), /Unknown maintenance command/);
});

test("process failures are propagated", () => {

    assert.throws(() => {

        run(process.execPath, [
            "-e",
            "process.exit(3)",
        ]);
    }, /failed \(3\)/);
    assert.throws(() => {

        run("avesd-nonexistent-command", []);
    }, /ENOENT/);
});

test("CLI rejects unknown options before running commands", () => {

    const result = spawnSync(process.execPath, [
        "scripts/dependencies/maintenance.mjs",
        "iud",
        "--unknown",
    ], {
        cwd: repositoryRoot,
        encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Only --dry-run/);
});

test("sorting dry-run leaves manifests and workspace policy unchanged", () => {

    const files = [
        "package.json",
        "pnpm-workspace.yaml",
        ...[
            "apps",
            "packages",
        ].flatMap((directory) => {

            return readdirSync(join(repositoryRoot, directory)).map((name) => {

                return `${directory}/${name}/package.json`;
            });
        }),
    ];
    const before = files.map((file) => {

        return readFileSync(join(repositoryRoot, file), "utf8");
    });
    sortFiles("sort-dependencies", true);
    sortFiles("sort-workspace", true);
    assert.deepEqual(files.map((file) => {

        return readFileSync(join(repositoryRoot, file), "utf8");
    }), before);
});

test("workspace dependency keys use scoped double quotes and unscoped plain syntax", () => {

    const original = `catalog:
  "zod": 4.6.5 # retain this comment
  '@types/node': 26.6.5
  'react': "19.3.0"
allowBuilds:
  "esbuild": true
  '@scope/native': false
`;
    const sorted = sortWorkspace(original);
    assert.deepEqual(parse(sorted), parse(original));
    assert.match(sorted, /^ {2}"@types\/node": 26\.6\.5$/m);
    assert.match(sorted, /^ {2}"@scope\/native": false$/m);
    assert.match(sorted, /^ {2}react: "19\.3\.0"$/m);
    assert.match(sorted, /^ {2}zod: 4\.6\.5 # retain this comment$/m);
    assert.match(sorted, /^ {2}esbuild: true$/m);
    assert.equal(sortWorkspace(sorted), sorted);
});

test("sort-dependencies only sorts manifests while sort-all also sorts workspace policy", async (context) => {

    const root = mkdtempSync(join(tmpdir(), "avesd-sorting-"));
    context.after(() => {

        rmSync(root, {
            recursive: true,
            force: true,
        });
    });
    mkdirSync(join(root, "apps/desktop"), { recursive: true });
    mkdirSync(join(root, "packages"));
    const manifest = '{"dependencies":{"zod":"catalog:","react":"catalog:"}}\n';
    const workspace = 'packages:\n  - packages/*\n  - apps/*\ncatalog:\n  "zod": 4.6.5\n  "react": 19.3.0\n';
    for (const path of [
        "package.json",
        "apps/desktop/package.json",
    ]) {
        writeFileSync(join(root, path), manifest);
    }
    writeFileSync(join(root, "pnpm-workspace.yaml"), workspace);
    sortFiles("sort-dependencies", true, root);
    assert.equal(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"), workspace);
    assert.equal(readFileSync(join(root, "package.json"), "utf8"), manifest);
    assert.equal(readFileSync(join(root, "apps/desktop/package.json"), "utf8"), manifest);
    sortFiles("sort-dependencies", false, root);
    assert.equal(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"), workspace);
    await main("sort-all", false, {
        sortFiles: (mode, dryRun) => {

            sortFiles(mode, dryRun, root);
        },
    });
    assert.equal(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"), sortWorkspace(workspace));
    for (const path of [
        "package.json",
        "apps/desktop/package.json",
    ]) {
        assert.equal(readFileSync(join(root, path), "utf8"), sortManifest(manifest));
    }
});
