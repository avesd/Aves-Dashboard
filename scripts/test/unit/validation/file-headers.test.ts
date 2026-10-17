/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Test_Unit_Validation
 * @description File Headers.test
 */

import { maintainHeaders, sourcePaths } from "../../../validation/file-headers.ts";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";

const fixture = (context: test.TestContext) => {

    const root = mkdtempSync(join(tmpdir(), "avesd-file-headers-"));
    context.after(() => {

        rmSync(root, {
            recursive: true,
            force: true,
        });
    });
    const write = (path: string, content: string): string => {

        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);

        return target;
    };
    write("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n  - packages-renderer/*\n  - packages-ui/*\n");
    for (const workspace of [
        "apps/desktop",
        "packages/example",
        "packages-renderer/canvas",
        "packages-ui/controls",
    ]) {
        write(`${workspace}/package.json`, JSON.stringify({ name: `@avesd/${workspace.split("/").at(-1)}` }));
    }

    return {
        root,
        write,
    };
};

const silent = (): void => {
};

await test("selects maintained files without visiting generated output, declarations or symlinks", (context) => {

    const { root, write } = fixture(context);
    const selected = [
        ".ts",
        ".tsx",
        ".mts",
        ".cts",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
    ].map((extension) => {

        return `packages/example/config${extension}`;
    });
    selected.push("eslint.config.mjs", ".github/scripts/check.cjs", "scripts/release/tool.ts", "apps/desktop/test/unit/example.test.ts", "packages-renderer/canvas/src/view.tsx", "packages-ui/controls/src/button.tsx");
    const excluded = [
        "working/scratch.ts",
        "packages/not-a-workspace/source.ts",
        "packages/example/types.d.ts",
        "packages/example/types.d.mts",
        "packages/example/types.d.cts",
    ];
    for (const directory of [
        "node_modules",
        ".git",
        ".turbo",
        ".pnpm-store",
        "dist",
        "out",
        "build",
        "coverage",
        "release",
    ]) {
        excluded.push(`packages/example/${directory}/generated.ts`);
    }
    for (const path of [
        ...selected,
        ...excluded,
    ]) {
        write(path, "export {};\n");
    }
    const external = write("working/external.ts", "export {};\n");
    symlinkSync(external, join(root, "packages/example/linked.ts"));
    symlinkSync(join(root, "working"), join(root, "packages/example/linked-directory"));

    const paths = sourcePaths(root).map((path) => {

        return relative(root, path);
    });

    assert.deepEqual(paths.sort(), selected.sort());
});

await test("check is read-only; fix preserves descriptions, annotations and executable content and is idempotent", (context) => {

    const { root, write } = fixture(context);
    const body = "export const fixture = `/**\n * @author Fixture\n * @package Fixture\n */`;\n";
    const original = "#!/usr/bin/env node\n\n/**\n * @author Avesd\n * @package Custom Package\n * @namespace Custom\n * @description A curated responsibility\n * @license MIT\n */\n" + body;
    const path = write("packages/example/config.mjs", original);
    const messages: string[] = [];

    const result = maintainHeaders("check", root, (message) => {

        messages.push(message);
    });

    assert.equal(result, 1);
    assert.equal(readFileSync(path, "utf8"), original);
    assert.equal(messages[0], "packages/example/config.mjs");

    maintainHeaders("fix", root, silent);

    const fixed = readFileSync(path, "utf8");
    assert.equal(fixed, original.replace("node\n\n", "node\n").replace(" */\nexport", " */\n\nexport"));

    maintainHeaders("fix", root, silent);

    assert.equal(readFileSync(path, "utf8"), fixed);
    assert.equal(maintainHeaders("check", root, silent), 0);
});

await test("fills missing fields from ownership and paths and retains a leading documentation comment", (context) => {

    const { root, write } = fixture(context);
    const documentation = "/** Describes the exported operation. */\nexport const operation = 1;\n";
    const path = write("packages/example/src/domain/operation.ts", documentation);
    const partial = write("scripts/release/check.ts", "/**\n * @package Scripts\n * @description\n * @license MIT\n */\nexport {};\n");
    const github = write(".github/scripts/check.cjs", "module.exports = {};\n");

    maintainHeaders("fix", root, silent);

    assert.equal(readFileSync(path, "utf8"), "/**\n * @author Avesd\n * @package Example\n * @namespace Domain\n * @description Operation\n */\n\n" + documentation);
    assert.match(readFileSync(partial, "utf8"), /@namespace Scripts_Release\n \* @description Check\n \* @license MIT/);
    assert.match(readFileSync(github, "utf8"), /@package GitHub\n \* @namespace GitHub_Scripts/);
    assert.equal(maintainHeaders("check", root, silent), 0);
});

await test("preserves BOM and CRLF and separates a shebang without a final newline", (context) => {

    const { root, write } = fixture(context);
    const body = "export const value = 1;\r\n";
    const path = write("packages/example/config.ts", "\uFEFF#!/usr/bin/env node\r\n" + body);
    const shebangOnly = write("scripts/tool.mjs", "#!/usr/bin/env node");

    maintainHeaders("fix", root, silent);

    const fixed = readFileSync(path, "utf8");
    assert.ok(fixed.startsWith("\uFEFF#!/usr/bin/env node\r\n/**\r\n"));
    assert.ok(fixed.endsWith(" */\r\n\r\n" + body));
    assert.ok(!/(?<!\r)\n/.test(fixed));
    assert.ok(readFileSync(shebangOnly, "utf8").startsWith("#!/usr/bin/env node\n/**\n"));
    assert.equal(maintainHeaders("check", root, silent), 0);
});
