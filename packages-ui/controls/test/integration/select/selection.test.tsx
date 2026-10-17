/**
 * @author Avesd
 * @package UI Controls
 * @namespace Test_Integration_Select
 * @description Selection, search, dismissal, disabled recovery, and browser form contracts
 */

import { Combobox } from "../../../src/select/combobox";
import { Select } from "../../../src/select/select";
import type { SelectionProps, SelectOption } from "../../../src/select/types";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useState } from "react";

const options: readonly SelectOption[] = [
    {
        value: "alpha",
        label: "Alpha",
        description: "local-alpha",
    },
    {
        value: "beta",
        label: "Beta",
        description: "remote-beta",
    },
    {
        value: "removed",
        label: "Removed",
        disabled: true,
    },
];
type ControlKind = "select" | "combobox";

function choice(kind: ControlKind, props: SelectionProps) {

    if (kind === "select") {
        return <Select
            aria-label="Choice"
            {...props}
        />;
    }

    return <Combobox
        aria-label="Choice"
        searchLabel="Search choices"
        emptyLabel="No matching choices"
        {...props}
    />;
}

afterEach(() => {

    cleanup();
});

for (const position of [
    "item-aligned",
    "popper",
] as const) {
    void test(`Select ${position} supports keyboard selection and Escape focus recovery`, async () => {

        const changes: string[] = [];
        const user = userEvent.setup();
        render(<Select
            aria-label="Choice"
            position={position}
            defaultValue="beta"
            options={options}
            onValueChange={value => {

                changes.push(value);
            }}
        />);
        const trigger = screen.getByRole("combobox", { name: "Choice" });

        await user.click(trigger);
        await screen.findByRole("option", { name: /^Beta/ });
        await user.keyboard("{Home}{Enter}");

        await waitFor(() => {

            equal(trigger.getAttribute("aria-expanded"), "false");
        });
        equal(trigger.textContent, "Alpha");
        deepStrictEqual(changes, ["alpha"]);
        equal(document.activeElement, trigger);

        await user.click(trigger);
        await screen.findByRole("option", { name: /^Alpha/ });
        await user.keyboard("{Escape}");

        await waitFor(() => {

            equal(trigger.getAttribute("aria-expanded"), "false");
        });
        equal(document.activeElement, trigger);
        deepStrictEqual(changes, ["alpha"]);
    });
}

void test("Combobox filters from its trigger input and commits only the confirmed choice", async () => {

    const changes: string[] = [];
    const user = userEvent.setup();
    render(<Combobox
        aria-label="Choice"
        searchLabel="Search choices"
        emptyLabel="No matching choices"
        defaultValue="alpha"
        options={[
            {
                label: "Available models",
                options,
            },
        ]}
        onValueChange={value => {

            changes.push(value);
        }}
    />);
    const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Choice" });

    await user.click(input);
    await user.clear(input);
    await user.type(input, "remote-beta");

    await screen.findByRole("option", { name: /^Beta/ });
    equal(screen.queryByRole("option", { name: /^Alpha/ }), null);
    deepStrictEqual(changes, []);

    await user.keyboard("{Enter}");

    await waitFor(() => {

        equal(input.value, "Beta");
    });
    equal(input.getAttribute("aria-expanded"), "false");
    deepStrictEqual(changes, ["beta"]);
    equal(document.activeElement, input);

    await user.clear(input);
    await user.type(input, "missing");
    await screen.findByText("No matching choices");
    await user.keyboard("{Escape}");

    await waitFor(() => {

        equal(input.value, "Beta");
    });
    deepStrictEqual(changes, ["beta"]);
});

for (const kind of [
    "select",
    "combobox",
] as const) {
    void test(`${kind} leaves controlled values with the caller and reflects external updates`, async () => {

        const changes: string[] = [];
        const user = userEvent.setup();
        const onValueChange = (value: string) => {

            changes.push(value);
        };
        const example = (value: string) => {

            return (<form
                aria-label="Controlled preference"
            >
                {choice(kind, {
                    options,
                    name: "model",
                    value,
                    onValueChange,
                })}
            </form>);
        };
        const view = render(example("alpha"));
        const form = screen.getByRole<HTMLFormElement>("form", { name: "Controlled preference" });
        const control = screen.getByRole("combobox", { name: "Choice" });

        await user.click(control);
        await user.click(await screen.findByRole("option", { name: /^Beta/ }));

        deepStrictEqual(changes, ["beta"]);
        deepStrictEqual(new FormData(form).getAll("model"), ["alpha"]);
        view.rerender(example("beta"));

        await waitFor(() => {

            if (control instanceof HTMLInputElement) {
                equal(control.value, "Beta");
            } else {
                equal(control.textContent, "Beta");
            }
        });
        deepStrictEqual(changes, ["beta"]);
    });

    void test(`${kind} submits one stable ID and respects canceled and successful form resets`, async () => {

        let cancelReset = true;
        const user = userEvent.setup();
        const view = render(<form
            aria-label="Preferences"
            onReset={event => {

                if (cancelReset) {
                    event.preventDefault();
                }
            }}
        >
            {choice(kind, {
                options,
                name: "model",
                defaultValue: "alpha",
            })}
            <button
                type="reset"
            >
                Reset preferences
            </button>
        </form>);
        const form = screen.getByRole<HTMLFormElement>("form", { name: "Preferences" });
        const control = screen.getByRole("combobox", { name: "Choice" });

        await user.click(control);
        await user.click(await screen.findByRole("option", { name: /^Beta/ }));

        deepStrictEqual(new FormData(form).getAll("model"), ["beta"]);
        await user.click(screen.getByRole("button", { name: "Reset preferences" }));
        deepStrictEqual(new FormData(form).getAll("model"), ["beta"]);

        cancelReset = false;
        await user.click(screen.getByRole("button", { name: "Reset preferences" }));

        await waitFor(() => {

            deepStrictEqual(new FormData(form).getAll("model"), ["alpha"]);
        });
        ok(view.container.contains(control));
    });

    void test(`${kind} closes when disabled and rejects portalled choices after its fieldset disables`, async () => {

        const changes: string[] = [];
        const user = userEvent.setup();
        const example = (controlDisabled: boolean, fieldsetDisabled: boolean) => {

            return (<fieldset
                disabled={fieldsetDisabled}
            >
                {choice(kind, {
                    options,
                    defaultValue: "alpha",
                    disabled: controlDisabled,
                    onValueChange: value => {

                        changes.push(value);
                    },
                })}
            </fieldset>);
        };
        const view = render(example(false, false));
        const control = screen.getByRole("combobox", { name: "Choice" });

        await user.click(control);
        await screen.findByRole("option", { name: /^Beta/ });
        view.rerender(example(true, false));

        await waitFor(() => {

            equal(control.getAttribute("aria-expanded"), "false");
        });
        view.rerender(example(false, false));
        equal(control.getAttribute("aria-expanded"), "false");

        await user.click(control);
        const beta = await screen.findByRole("option", { name: /^Beta/ });
        view.rerender(example(false, true));
        await user.click(beta);

        deepStrictEqual(changes, []);
    });

    void test(`${kind} validates the selected value and returns focus to the visible control`, () => {

        render(<form
            aria-label="Required preference"
        >
            {choice(kind, {
                options,
                name: "model",
                required: true,
            })}
        </form>);
        const form = screen.getByRole<HTMLFormElement>("form", { name: "Required preference" });
        const control = screen.getByRole("combobox", { name: "Choice" });

        equal(form.checkValidity(), false);
        equal(document.activeElement, control);
    });

    void test(`${kind} consumes the inner Escape before the enclosing dialog closes`, async () => {

        function Dialog() {

            const [
                open,
                setOpen,
            ] = useState(true);
            const [
                container,
                setContainer,
            ] = useState<HTMLDivElement | null>(null);
            if (!open) {
                return <p>Dialog closed</p>;
            }

            return <div
                role="dialog"
                aria-label="Route configuration"
                ref={setContainer}
                onKeyDown={event => {

                    if (event.key === "Escape") {
                        setOpen(false);
                    }
                }}
            >
                {container && choice(kind, {
                    options,
                    defaultValue: "alpha",
                    portalContainer: container,
                })}
            </div>;
        }
        const user = userEvent.setup();
        render(<Dialog />);
        const control = screen.getByRole("combobox", { name: "Choice" });

        await user.click(control);
        await screen.findByRole("option", { name: /^Alpha/ });
        await user.keyboard("{Escape}");

        await waitFor(() => {

            equal(control.getAttribute("aria-expanded"), "false");
        });
        ok(screen.getByRole("dialog", { name: "Route configuration" }));
        equal(document.activeElement, control);

    });
}
