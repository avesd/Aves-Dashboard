/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description RuntimePickerDialog
 */

import type { RuntimePickerProps } from "./runtime-picker-types";
import { RuntimeRouteFields } from "./RuntimeRouteFields";
import type { useRuntimePicker } from "./useRuntimePicker";
import { Button } from "@avesd/ui-controls";
import { RefreshCw, X } from "lucide-react";

interface Props {
    readonly picker: ReturnType<typeof useRuntimePicker>;
    readonly applying: boolean;
    readonly session: RuntimePickerProps["session"];
    readonly manage: () => void;
}

export function RuntimePickerDialog({ picker, applying, session, manage }: Props) {

    const { draft, close, loading, missingModel, missingEffort, waiting, optionsError, message, failed, testing, options, setRefresh, test, setOpen, unavailable, save } = picker;
    if (!draft) {
        return null;
    }

    return <section
        className="controller-runtime-popover"
        role="dialog"
        aria-label="Agent configuration"
        onKeyDown={event => {

            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        }}
    >
        <header>
            <div>
                <strong>Choose your agent</strong>
                <span>Agent · model · reasoning effort</span>
            </div>
            <Button
                layout="icon"
                variant="quiet"
                size="small"
                type="button"
                aria-label="Close agent configuration"
                onClick={close}
            >
                <X
                    size={16}
                />
            </Button>
        </header>
        <RuntimeRouteFields
            picker={picker}
            applying={applying}
        />
        {loading && <p
            role="status"
        >
            Loading models from Agent…
        </p>}
        {missingModel && <p
            role="alert"
        >
            Choose an offered model or the Agent default.
        </p>}
        {missingEffort && <p
            role="alert"
        >
            Choose an available effort or the Agent default.
        </p>}
        {waiting && <p
            className="controller-runtime-note"
        >
            Answer the pending canvas question before changing its model. Another Agent opens a separate conversation.
        </p>}
        {(optionsError || message) && <p
            className={optionsError || failed ? "controller-runtime-failure" : "controller-runtime-success"}
            role={optionsError || failed ? "alert" : "status"}
        >
            {optionsError || message}
        </p>}
        <div
            className="controller-runtime-tools"
        >
            <Button
                variant="quiet"
                size="small"
                type="button"
                disabled={loading || testing || applying}
                onClick={() => {

                    setRefresh(value => {

                        return value + 1;
                    });
                }}
            >
                <RefreshCw
                    size={12}
                />
                Refresh
            </Button>
            <Button
                variant="quiet"
                size="small"
                type="button"
                disabled={!options || loading || testing || applying || missingModel || missingEffort}
                onClick={() => {

                    void test();
                }}
            >
                {testing ? "Checking…" : "Check access"}
            </Button>
            <Button
                variant="quiet"
                size="small"
                type="button"
                onClick={() => {

                    setOpen(false);
                    manage();
                }}
            >
                Manage Agents
            </Button>
        </div>
        <p
            className="controller-runtime-note"
        >
            Model options are configured locally. Check access sends one short request.
        </p>
        <footer>
            <span>
                {session && session.route.providerId !== draft.providerId ? "Opens a new conversation; keeps the current one." : "Keeps this conversation and its context."}
            </span>
            <Button
                variant="primary"
                size="small"
                type="button"
                className="controller-runtime-apply shrink-0"
                disabled={loading || applying || testing || !options || unavailable || missingModel || missingEffort || waiting}
                onClick={() => {

                    void save();
                }}
            >
                {applying ? "Connecting…" : "Apply"}
            </Button>
        </footer>
    </section>;
}
