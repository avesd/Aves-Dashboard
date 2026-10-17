/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Exercise controller resizing and settings through real preload and IPC
 */

import { expect, test } from "./desktop-fixture";

test("controller expands and collapses its native window", async ({ controller, desktop }) => {

    const nativeWindow = await desktop.browserWindow(controller);
    const initial = await nativeWindow.evaluate(window => {

        return window.getBounds();
    });

    await controller.getByRole("button", {
        name: "Open controller",
        exact: true,
    }).click();

    await expect(controller.getByRole("navigation", { name: "Controller panels" })).toBeVisible();
    await expect.poll(async () => {

        const bounds = await nativeWindow.evaluate(window => {

            return window.getBounds();
        });

        return bounds.height;
    }).toBeGreaterThan(initial.height);

    await controller.getByRole("button", {
        name: "Collapse controller",
        exact: true,
    }).click();

    await expect(controller.getByRole("navigation", { name: "Controller panels" })).toBeHidden();
    await expect.poll(async () => {

        const bounds = await nativeWindow.evaluate(window => {

            return window.getBounds();
        });

        return {
            width: bounds.width,
            height: bounds.height,
        };
    }).toEqual({
        width: initial.width,
        height: initial.height,
    });
});

test("settings opens from the controller and can reopen after closing", async ({ controller, desktop }) => {

    await controller.getByRole("button", {
        name: "Open controller",
        exact: true,
    }).click();

    const opened = desktop.waitForEvent("window");
    await controller.getByRole("button", {
        name: "Settings",
        exact: true,
    }).click();
    const settings = await opened;

    await expect(settings.getByRole("heading", {
        name: "Settings",
        exact: true,
    })).toBeVisible();
    await expect(settings.getByRole("region", { name: "Agent installations" })).toBeVisible();

    await settings.close();

    const reopened = desktop.waitForEvent("window");
    await controller.getByRole("button", {
        name: "Settings",
        exact: true,
    }).click();
    const nextSettings = await reopened;

    await expect(nextSettings.getByRole("heading", {
        name: "Settings",
        exact: true,
    })).toBeVisible();
});
