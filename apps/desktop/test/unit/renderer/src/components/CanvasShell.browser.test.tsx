import "../../../../../src/renderer/src/styles.css";
import "@avesd/ui/styles.css";
import { CanvasShell } from "../../../../../src/renderer/src/components/CanvasShell";
import type { AgentSessionsApi } from "../../../../../src/shared/agent/sessions";
import type { CanvasApi } from "../../../../../src/shared/workspace/canvas";
import type { Dashboard, DashboardScope } from "@avesd/workspace-model";
import { applyCanvas, readCanvas } from "@avesd/workspace-model";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";

let root: Root | undefined;

afterEach(() => {

    root?.unmount();
    document.body.replaceChildren();
});

it("adds and edits a canvas card through the split renderer", async () => {

    await page.viewport(1_200, 800);
    const scope: DashboardScope = {
        workspaceId: "workspace" as DashboardScope["workspaceId"],
        dashboardId: "dashboard" as DashboardScope["dashboardId"],
    };
    const dashboard: Dashboard = {
        ...scope,
        id: scope.dashboardId,
        name: "Synthetic canvas",
        layoutRevision: 0,
        viewState: {},
    };
    let state = readCanvas(dashboard);
    const listeners = new Set<() => void>();
    const api: CanvasApi = {
        inspect: async () => {

            return state;
        },
        apply: async (_scope, command) => {

            state = applyCanvas(state, command);
            listeners.forEach(listener => {

                listener();
            });

            return state;
        },
        subscribe: listener => {

            listeners.add(listener);

            return () => {

                listeners.delete(listener);
            };
        },
    };
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    root.render(<CanvasShell
        api={api}
        agent={{} as AgentSessionsApi}
        scope={scope}
    />);

    await expect.element(page.getByText("A space for your thoughts.")).toBeVisible();
    await page.getByRole("button", {
        name: "Idea",
        exact: true,
    }).click();
    await expect.element(page.getByText("New thought")).toBeVisible();
    await page.getByText("New thought").dblClick();
    await page.getByRole("textbox", { name: "Edit card text" }).fill("Revised thought");
    await page.getByRole("button", { name: "Save" }).click();
    await expect.element(page.getByText("Revised thought")).toBeVisible();
    expect(state.items[0]?.content.text).toBe("Revised thought");
    await page.getByRole("button", { name: "Fit" }).click();
    await expect.element(page.getByText("100%", { exact: false })).toBeVisible();
});
