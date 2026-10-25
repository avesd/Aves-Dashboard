/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Workbench
 * @description Preference commits serialize fields and recover after failed writes
 */

import { WorkbenchPreferences } from "../../../../src/main/workbench/preferences";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

void test("queued preference changes preserve each other's committed fields", async t => {

    const root = await mkdtemp(join(tmpdir(), "avesd-preferences-"));
    t.after(async () => {

        await rm(root, {
            recursive: true,
            force: true,
        });
    });
    const path = join(root, "preferences.json");
    const preferences = await WorkbenchPreferences.open(path);

    const side = preferences.setSide("left");
    const position = preferences.setSessionPosition(3);
    await Promise.all([
        side,
        position,
    ]);

    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
        sidebarSide: "left",
        sessionPosition: 3,
    });
    assert.equal(preferences.side, "left");
    assert.equal(preferences.sessionPosition, 3);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(root), ["preferences.json"]);
});

void test("failed commits leave memory unchanged and later writes can recover", async t => {

    const root = await mkdtemp(join(tmpdir(), "avesd-preferences-recovery-"));
    t.after(async () => {

        await rm(root, {
            recursive: true,
            force: true,
        });
    });
    const parent = join(root, "missing");
    const path = join(parent, "preferences.json");
    const preferences = await WorkbenchPreferences.open(path);

    await assert.rejects(preferences.setSide("left"));

    assert.equal(preferences.side, "right");
    assert.equal(preferences.sessionPosition, 2);

    await mkdir(parent);
    await preferences.setSessionPosition(1);

    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
        sidebarSide: "right",
        sessionPosition: 1,
    });
    assert.deepEqual(await readdir(parent), ["preferences.json"]);
});
