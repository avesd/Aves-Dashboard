/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Windows
 * @description Settings Access.test
 */

import { isSettingsSender } from "../../../../src/main/windows/settings-access";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("settings IPC accepts only its registered webContents and exact main frame", () => {

    const settings = { mainFrame: {} };
    const controller = { mainFrame: {} };
    assert.equal(isSettingsSender({
        sender: settings,
        senderFrame: settings.mainFrame,
    }, settings), true);
    assert.equal(isSettingsSender({
        sender: controller,
        senderFrame: controller.mainFrame,
    }, settings), false);
    assert.equal(isSettingsSender({
        sender: settings,
        senderFrame: {},
    }, settings), false);
    assert.equal(isSettingsSender({
        sender: settings,
        senderFrame: settings.mainFrame,
    }, undefined), false);
});
