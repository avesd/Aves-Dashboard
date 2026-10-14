import "../../../../../src/renderer/src/styles.css";
import "@avesd/ui/styles.css";
import { CanvasShell } from "../../../../../src/renderer/src/components/CanvasShell";
import type { CanvasServiceApi } from "../../../../../src/shared/canvas/contracts";
import type { Dashboard, DashboardScope } from "@avesd/workspace-model";
import { applyCanvas, readCanvas } from "@avesd/workspace-model";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

let root: Root | undefined;

afterEach(() => {

    root?.unmount();
    document.body.replaceChildren();
});

it("keeps manual interaction read-only while displaying agent updates", async () => {

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
    const api = {
        read: async () => {

            return {
                ...state,
                id: "dashboard",
                title: "Synthetic canvas",
                updatedAt: null,
                canUndo: state.history.length > 0,
            };
        },
        apply: vi.fn(),
        subscribe: (listener: () => void) => {

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
        api={api as unknown as CanvasServiceApi}
        canvasId="dashboard"
        openController={() => {
        }}
    />);

    await expect.element(page.getByLabelText("Dashboard surface")).toBeVisible();
    expect(document.querySelector(".canvas-empty")).toBeNull();
    await page.getByLabelText("Dashboard surface").dblClick();
    expect(state.items).toHaveLength(0);
    state = applyCanvas(state, {
        expectedRevision: state.revision,
        operations: [
            {
                type: "add",
                item: {
                    id: "agent-idea",
                    content: {
                        kind: "idea",
                        version: 1,
                        text: "Agent finding",
                    },
                    placement: {
                        x: 300,
                        y: 250,
                        width: 280,
                        height: 180,
                    },
                },
            },
        ],
    });
    listeners.forEach(listener => {

        return void listener();
    });
    await expect.element(page.getByText("Agent finding")).toBeVisible();
    await page.getByText("Agent finding").dblClick();
    expect(document.querySelector(".canvas-item.is-selected")).not.toBeNull();
    expect(document.querySelector("textarea, input")).toBeNull();
    for (const key of [
        "Delete",
        "Backspace",
        "z",
    ]) {
        window.dispatchEvent(new KeyboardEvent("keydown", {
            key,
            ctrlKey: key === "z",
            bubbles: true,
        }));
    }
    const surface = document.querySelector<HTMLElement>(".canvas-surface")!;
    surface.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: -120,
        clientX: 400,
        clientY: 300,
    }));
    await expect.poll(() => {

        return document.querySelector(".dashboard-zoom")?.textContent;
    }).not.toBe("100%");
    surface.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: 30,
        clientY: 30,
    }));
    await expect.element(page.getByRole("menuitem", { name: "Show all" })).toBeVisible();
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    await page.getByRole("menuitem", { name: "Show all" }).click();
    await expect.poll(() => {

        return document.querySelector(".dashboard-zoom")?.textContent;
    }).toBe("100%");
    expect(api.apply).not.toHaveBeenCalled();
    state = applyCanvas(state, {
        expectedRevision: state.revision,
        operations: [
            {
                type: "update",
                id: "agent-idea",
                text: "Updated by agent",
            },
        ],
    });
    listeners.forEach(listener => {

        return void listener();
    });
    await expect.element(page.getByText("Updated by agent")).toBeVisible();
});
