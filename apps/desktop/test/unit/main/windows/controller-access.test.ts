/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Windows
 * @description Controller Access.test
 */

import { assertControllerSender } from "../../../../src/main/windows/controller-access";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("controller identity requires its exact webContents and main frame without an Agent service", () => {

    const mainFrame = {};
    const contents = { mainFrame };
    const window = { webContents: contents } as unknown as BrowserWindow;
    const event = {
        sender: contents,
        senderFrame: mainFrame,
    } as unknown as IpcMainInvokeEvent;
    assert.doesNotThrow(() => {

        return void assertControllerSender(event, window);
    });
    assert.throws(() => {

        return void assertControllerSender(event, undefined);
    }, /controller main frame/);
    assert.throws(() => {

        return void assertControllerSender({
            ...event,
            sender: {},
        } as IpcMainInvokeEvent, window);
    }, /controller main frame/);
    assert.throws(() => {

        return void assertControllerSender({
            ...event,
            senderFrame: {},
        } as IpcMainInvokeEvent, window);
    }, /controller main frame/);
});
