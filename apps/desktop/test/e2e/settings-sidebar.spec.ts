/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Native settings navigation, draft retention, resizing and compact recovery
 */

import { expect, test } from "./desktop-fixture";

test("settings sidebar preserves drafts, resizes and restores after a narrow window", async ({ controller, desktop }) => {

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
    const nativeWindow = await desktop.browserWindow(settings);
    const sidebar = settings.getByRole("complementary", { name: "Settings sidebar" });
    const handle = settings.getByRole("separator", { name: "Resize settings sidebar" });
    const models = settings.getByRole("button", {
        name: "Models & services",
        exact: true,
    });
    const tiers = settings.getByRole("button", {
        name: "Agent tiers",
        exact: true,
    });
    await expect(models).toHaveAttribute("aria-current", "page");

    await tiers.click();
    const model = settings.getByRole("combobox", {
        name: "Flagship model",
        exact: true,
    });
    await expect(model).toBeEnabled();
    await model.click();
    await settings.getByRole("option", {
        name: "deepseek-v4-pro",
        exact: true,
    }).click();
    await models.click();
    await expect(settings.getByRole("region", {
        name: "Agent tiers",
        exact: true,
    })).toBeHidden();
    await tiers.click();
    await expect(model).toHaveValue("deepseek-v4-pro");

    await handle.focus();
    await settings.keyboard.press("End");
    await expect(handle).toHaveAttribute("aria-valuenow", "360");
    await settings.keyboard.press("Home");
    await expect(handle).toHaveAttribute("aria-valuenow", "192");
    await handle.dblclick();
    await expect(handle).toHaveAttribute("aria-valuenow", "216");
    await expect.poll(async () => {

        return Math.round((await sidebar.boundingBox())?.width ?? 0);
    }).toBe(216);
    const bounds = await handle.boundingBox();
    if (!bounds) {
        throw new Error("Sidebar resize handle is not visible.");
    }
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + 120;
    await settings.mouse.move(x, y);
    await settings.mouse.down();
    await settings.mouse.move(x + 64, y, { steps: 5 });
    await settings.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "280");

    await settings.mouse.move(x + 64, y);
    await settings.mouse.down();
    await settings.mouse.move(x + 96, y, { steps: 3 });
    await settings.keyboard.press("Escape");
    await settings.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "280");

    await settings.getByRole("button", { name: "Collapse settings sidebar" }).click();
    const expand = settings.getByRole("button", { name: "Expand settings sidebar" });
    await expect(expand).toBeFocused();
    await expect(handle).toBeHidden();
    await models.click();
    await expect(models).toHaveAttribute("aria-current", "page");
    await expand.click();
    await expect(handle).toHaveAttribute("aria-valuenow", "280");

    await nativeWindow.evaluate(window => {

        window.setSize(560, 480);
    });
    await expect(handle).toBeHidden();
    await expect(models).toBeVisible();
    await tiers.click();
    await expect(model).toHaveValue("deepseek-v4-pro");
    await expect.poll(async () => {

        return settings.locator("html").evaluate((element: {
            scrollWidth: number;
            clientWidth: number;
        }) => {

            return element.scrollWidth <= element.clientWidth;
        });
    }).toBe(true);

    await nativeWindow.evaluate(window => {

        window.setSize(840, 800);
    });
    await expect(handle).toHaveAttribute("aria-valuenow", "280");
    await expect(handle).toBeVisible();
    await expect(settings.getByRole("button", { name: "Save agent tiers" })).toBeEnabled();
});
