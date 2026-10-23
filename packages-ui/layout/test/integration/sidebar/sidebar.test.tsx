/**
 * @author Avesd
 * @package UI Layout
 * @namespace Test_Integration_Sidebar
 * @description Sidebar keyboard, controlled state, native navigation, and compact recovery
 */

import { Sidebar, SidebarMain } from "../../../src/sidebar/sidebar";
import type { SidebarLayoutProps } from "../../../src/sidebar/sidebar-layout";
import { SidebarLayout } from "../../../src/sidebar/sidebar-layout";
import { SidebarItem, SidebarLink } from "../../../src/sidebar/sidebar-navigation";
import { SidebarContent, SidebarGroup, SidebarHeader } from "../../../src/sidebar/sidebar-regions";
import { SidebarResizeHandle } from "../../../src/sidebar/sidebar-resize-handle";
import { SidebarToggle } from "../../../src/sidebar/sidebar-toggle";
import { resizeContainer } from "../../setup-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deepStrictEqual, equal } from "node:assert/strict";
import { afterEach, test } from "node:test";

function Example(props: SidebarLayoutProps) {

    return <SidebarLayout
        {...props}
    >
        <Sidebar>
            <SidebarHeader
                title="Settings"
            >
                <SidebarToggle
                    expandLabel="Expand sidebar"
                    collapseLabel="Collapse sidebar"
                />
            </SidebarHeader>
            <SidebarContent
                aria-label="Settings"
            >
                <SidebarGroup
                    label="Workspace"
                >
                    <SidebarItem
                        label="Models"
                        icon={<span>M</span>}
                        active
                    />
                    <SidebarItem
                        label="Unavailable"
                        icon={<span>U</span>}
                        disabled
                    />
                    <SidebarLink
                        label="Guide"
                        icon={<span>G</span>}
                        href="/guide"
                        target="_blank"
                    />
                </SidebarGroup>
            </SidebarContent>
            <SidebarResizeHandle
                label="Resize sidebar"
            />
        </Sidebar>
        <SidebarMain>Content</SidebarMain>
    </SidebarLayout>;
}

afterEach(() => {

    cleanup();
});

void test("optional group labels preserve accessible names and navigation", async () => {

    const user = userEvent.setup();
    const navigation = <SidebarLink
        label="Guide"
        icon={<span>G</span>}
        href="/guide"
    />;
    const view = render(<SidebarLayout>
        <Sidebar>
            <SidebarGroup
                label="Workspace"
            >
                {navigation}
            </SidebarGroup>
        </Sidebar>
    </SidebarLayout>);
    const group = screen.getByRole("group", { name: "Workspace" });
    equal(group.getAttribute("aria-labelledby"), screen.getByText("Workspace").id);

    view.rerender(<SidebarLayout>
        <Sidebar>
            <SidebarGroup
                aria-label="Workspace"
            >
                {navigation}
            </SidebarGroup>
        </Sidebar>
    </SidebarLayout>);

    equal(screen.queryByText("Workspace"), null);
    equal(screen.getByRole("group", { name: "Workspace" }).hasAttribute("aria-labelledby"), false);
    await user.tab();
    equal(document.activeElement, screen.getByRole("link", { name: "Guide" }));
    equal(screen.getByRole("link", { name: "Guide" }).getAttribute("href"), "/guide");

    view.rerender(<SidebarLayout>
        <Sidebar>
            <span
                id="navigation-title"
            >
                Navigation
            </span>
            <SidebarGroup
                label=" "
                aria-labelledby="navigation-title"
            >
                {navigation}
            </SidebarGroup>
        </Sidebar>
    </SidebarLayout>);

    equal(screen.getByRole("group", { name: "Navigation" }).getAttribute("aria-labelledby"), "navigation-title");
});

void test("collapse retains toggle focus, current navigation and expanded width", async () => {

    const user = userEvent.setup();
    render(<Example />);
    const handle = screen.getByRole("separator");
    act(() => {

        handle.focus();
    });
    await user.keyboard("{ArrowRight}");
    equal(handle.getAttribute("aria-valuenow"), "232");

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    equal(document.activeElement, screen.getByRole("button", { name: "Expand sidebar" }));
    equal(screen.queryByRole("separator"), null);
    equal(screen.getByRole("button", { name: "Models" }).getAttribute("aria-current"), "page");
    equal(screen.getByRole("button", { name: "Models" }).title, "Models");

    await user.keyboard("{Enter}");
    equal(screen.getByRole("separator").getAttribute("aria-valuenow"), "232");
    equal(document.activeElement, screen.getByRole("button", { name: "Collapse sidebar" }));
});

void test("keyboard resizing respects limits, right-side direction and default reset", async () => {

    const committed: number[] = [];
    const user = userEvent.setup();
    render(<Example
        side="right"
        onWidthCommit={value => {

            committed.push(value);
        }}
    />);
    const handle = screen.getByRole("separator");
    act(() => {

        handle.focus();
    });
    await user.keyboard("{ArrowLeft}{End}{ArrowLeft}{Home}{ArrowRight}");
    equal(handle.getAttribute("aria-valuenow"), "192");
    deepStrictEqual(committed, [
        232,
        360,
        360,
        192,
        192,
    ]);

    fireEvent.doubleClick(handle);
    equal(handle.getAttribute("aria-valuenow"), "216");
});

void test("controlled state requests changes and follows the owner", async () => {

    const changes: boolean[] = [];
    const widths: number[] = [];
    const user = userEvent.setup();
    const props = {
        expanded: true,
        width: 240,
        onExpandedChange: (value: boolean) => {

            changes.push(value);
        },
        onWidthChange: (value: number) => {

            widths.push(value);
        },
    };
    const view = render(<Example
        {...props}
    />);
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    equal(screen.getByRole("button", { name: "Collapse sidebar" }).getAttribute("aria-expanded"), "true");
    deepStrictEqual(changes, [false]);
    act(() => {

        screen.getByRole("separator").focus();
    });
    await user.keyboard("{ArrowRight}");
    deepStrictEqual(widths, [256]);
    equal(screen.getByRole("separator").getAttribute("aria-valuenow"), "240");

    view.rerender(<Example
        {...props}
        expanded={false}
        width={256}
    />);
    equal(screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded"), "false");
    view.rerender(<Example
        {...props}
        width={256}
    />);
    equal(screen.getByRole("separator").getAttribute("aria-valuenow"), "256");
});

void test("compact layout retains user preference and native link semantics", async () => {

    const user = userEvent.setup();
    render(<Example />);
    act(() => {

        resizeContainer(560);
    });
    equal(screen.queryByRole("separator"), null);
    equal(screen.queryByRole("button", { name: "Expand sidebar" }), null);
    const link = screen.getByRole("link", { name: "Guide" });
    equal(link.getAttribute("href"), "/guide");
    equal(link.getAttribute("target"), "_blank");
    equal(link.title, "Guide");
    act(() => {

        resizeContainer(840);
    });
    equal(screen.getByRole("separator").getAttribute("aria-valuenow"), "216");

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    act(() => {

        resizeContainer(560);
        resizeContainer(840);
    });
    equal(screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded"), "false");
});
