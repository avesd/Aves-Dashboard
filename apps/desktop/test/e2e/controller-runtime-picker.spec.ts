/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Preserve nested runtime popup selection, dismissal and focus using synthetic providers
 */

import { expect, test } from "./desktop-fixture";

test("runtime popover keeps nested choices inside and returns focus after dismissal", async ({ desktop, controller }) => {

    await desktop.evaluate(({ ipcMain }) => {

        const route = {
            providerId: "synthetic-provider",
            modelId: "",
            effortId: "",
        };
        ipcMain.removeHandler("agent-providers:availability");
        ipcMain.handle("agent-providers:availability", () => {

            return {
                ok: true,
                value: [
                    {
                        id: route.providerId,
                        name: "Synthetic Agent",
                        enabled: true,
                        kind: "api",
                        readiness: "configured",
                    },
                ],
            };
        });
        ipcMain.removeHandler("agent-sessions:command");
        ipcMain.handle("agent-sessions:command", (_event, request: {
            type: string;
        }) => {

            let value: unknown;
            switch (request.type) {
                case "list":
                    value = { sessions: [] };
                    break;
                case "routes":
                    value = {
                        flagship: route,
                        reasoning: route,
                        action: route,
                    };
                    break;
                case "probeRoute":
                    value = {
                        ok: true,
                        tested: false,
                        options: {
                            models: [
                                {
                                    id: "synthetic-model",
                                    name: "Synthetic Model",
                                },
                            ],
                            efforts: [
                                {
                                    id: "standard",
                                    name: "Standard",
                                },
                            ],
                            defaultModelId: "synthetic-model",
                            defaultEffortId: "standard",
                        },
                    };
                    break;
                default:
                    throw new Error("Unexpected synthetic runtime command");
            }

            return {
                ok: true,
                value,
            };
        });
    });
    await controller.reload();
    await controller.getByRole("button", { name: "Open controller" }).click();
    const trigger = controller.getByRole("button", { name: "Choose Agent, model and effort" });
    const dialog = controller.getByRole("dialog", { name: "Agent configuration" });

    await trigger.click();
    const model = dialog.getByRole("combobox", { name: "Conversation model" });
    await expect(model).toBeEnabled();
    await model.click();
    await controller.getByRole("option", { name: /^Synthetic Model/ }).click();
    await expect(dialog).toBeVisible();
    await expect(model).toHaveValue("Synthetic Model");

    await model.click();
    await controller.keyboard.press("Escape");
    await expect(controller.getByRole("listbox")).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(model).toBeFocused();
    await controller.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("button", { name: "Close agent configuration" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await controller.locator(".controller-header strong").click();
    await expect(dialog).toBeHidden();
});
