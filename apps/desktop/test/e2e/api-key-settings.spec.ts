/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Native secure credential lifecycle through the settings preload and IPC
 */

import { expect, test } from "./desktop-fixture";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

test("settings saves, replaces and deletes encrypted API keys without restarting", async ({ controller, desktop }) => {

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
    const secure = await desktop.evaluate(({ safeStorage }) => {

        return safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
    });
    const openai = settings.getByRole("article", {
        name: "OpenAI",
        exact: true,
    });
    await expect(openai.getByText("Not configured", { exact: true })).toBeVisible();
    if (!secure) {
        await expect(settings.getByRole("alert")).toContainText("System secure storage is unavailable");
        await expect(openai.getByRole("button", { name: "Add OpenAI API key" })).toBeDisabled();

        return;
    }
    await openai.getByRole("button", { name: "Add OpenAI API key" }).click();
    const field = openai.getByLabel("OpenAI API key", { exact: true });
    await expect(field).toHaveAttribute("type", "password");
    await field.fill("synthetic-native-key");
    await openai.getByRole("button", {
        name: "Save key",
        exact: true,
    }).click();
    await expect(openai.getByText("Configured", { exact: true })).toBeVisible();
    await expect(field).toHaveCount(0);
    await expect(openai.getByRole("button", { name: "Test OpenAI connection" })).toBeEnabled();
    const userData = await desktop.evaluate(({ app }) => {

        return app.getPath("userData");
    });
    const path = join(userData, "credentials-v1", "openai.enc");
    const ciphertext = await readFile(path);
    expect(ciphertext.includes("synthetic-native-key")).toBe(false);
    if (process.platform !== "win32") {
        expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
    await openai.getByRole("button", { name: "Replace OpenAI API key" }).click();
    await expect(field).toHaveValue("");
    await field.fill("synthetic-replaced-key");
    await openai.getByRole("button", {
        name: "Save key",
        exact: true,
    }).click();
    await expect(openai.getByText("Configured", { exact: true })).toBeVisible();
    const replacement = await desktop.evaluate(({ safeStorage }, encoded) => {

        return safeStorage.decryptString(Buffer.from(encoded, "base64")) === "synthetic-replaced-key";
    }, (await readFile(path)).toString("base64"));
    expect(replacement).toBe(true);

    await settings.close();
    const reopened = desktop.waitForEvent("window");
    await controller.getByRole("button", {
        name: "Settings",
        exact: true,
    }).click();
    const next = await reopened;
    const card = next.getByRole("article", {
        name: "OpenAI",
        exact: true,
    });
    await expect(card.getByText("Configured", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Delete OpenAI API key" }).click();
    await card.getByRole("button", {
        name: "Cancel",
        exact: true,
    }).click();
    await expect(card.getByText("Configured", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Delete OpenAI API key" }).click();
    await card.getByRole("button", { name: "Confirm deletion" }).click();
    await expect(card.getByText("Not configured", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Test OpenAI connection" })).toBeDisabled();
    expect(existsSync(path)).toBe(false);
});
