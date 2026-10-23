/**
 * @author Avesd
 * @package UI Layout
 * @namespace Test_Integration_Headings
 * @description Optional heading labels release layout space while retaining content and actions
 */

import { SectionHeading } from "../../../src/headings/SectionHeading";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { equal } from "node:assert/strict";
import { afterEach, test } from "node:test";

afterEach(() => {

    cleanup();
});

void test("removing an eyebrow releases its column and keeps heading actions usable", async () => {

    let refreshed = false;
    const user = userEvent.setup();
    const props = {
        title: "Models",
        description: "Changes apply to new conversations.",
        actions: <button
            onClick={() => {

                refreshed = true;
            }}
        >
            Refresh
        </button>,
    };
    const view = render(<SectionHeading
        {...props}
        eyebrow="Services"
    />);
    equal(screen.getByText("Services").tagName, "P");

    for (const eyebrow of [
        undefined,
        " ",
    ]) {
        view.rerender(<SectionHeading
            {...props}
            eyebrow={eyebrow}
        />);

        equal(screen.queryByText("Services"), null);
        equal(view.container.querySelector("p"), null);
        equal(view.container.firstElementChild?.childElementCount, 1);
        equal(screen.getByRole("heading", { name: "Models" }).tagName, "H2");
        equal(screen.getByText(props.description).textContent, props.description);
    }

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    equal(refreshed, true);
});
