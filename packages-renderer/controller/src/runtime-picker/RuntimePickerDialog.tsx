/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description RuntimePickerDialog
 */

import type { RuntimePickerProps } from "./runtime-picker-types";
import { RuntimeRouteFields } from "./RuntimeRouteFields";
import type { useRuntimePicker } from "./useRuntimePicker";
import { Button, PopoverPanel } from "@avesd/ui-controls";
import { InlineNotice } from "@avesd/ui-data";
import { Row, Split, Stack } from "@avesd/ui-grid";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

interface Props {
    readonly picker: ReturnType<typeof useRuntimePicker>;
    readonly applying: boolean;
    readonly session: RuntimePickerProps["session"];
    readonly manage: () => void;
}

export function RuntimePickerDialog({ picker, applying, session, manage }: Props) {

    const [
        portalContainer,
        setPortalContainer,
    ] = useState<HTMLDivElement | null>(null);
    const { draft, close, loading, missingModel, missingEffort, waiting, optionsError, message, failed, testing, options, refreshOptions, test, unavailable, save } = picker;
    if (!draft) {
        return null;
    }

    return <PopoverPanel
        ref={setPortalContainer}
        side="top"
        sideOffset={0}
        collisionPadding={0}
        className="controller-runtime-popover w-(--radix-popover-trigger-width) max-w-[100vw] rounded-none"
        aria-label="Agent configuration"
    >
        <Split
            direction="column"
        >
            <Stack
                gap={16}
            >
                <Row
                    gap={8}
                    align="center"
                    justify="between"
                >
                    <strong
                        className="controller-runtime-title"
                    >
                        Choose your agent
                    </strong>
                    <Button
                        layout="icon"
                        variant="quiet"
                        size="small"
                        type="button"
                        className="controller-runtime-close"
                        aria-label="Close agent configuration"
                        onClick={close}
                    >
                        <X
                            size={16}
                        />
                    </Button>
                </Row>
                <RuntimeRouteFields
                    picker={picker}
                    portalContainer={portalContainer}
                    applying={applying}
                />
                {loading && <InlineNotice
                    className="rounded-none type-caption"
                    announcement="polite"
                >
                    Loading models from Agent…
                </InlineNotice>}
                {missingModel && <InlineNotice
                    className="rounded-none type-caption"
                    tone="danger"
                    announcement="assertive"
                >
                    Choose an offered model or the Agent default.
                </InlineNotice>}
                {missingEffort && <InlineNotice
                    className="rounded-none type-caption"
                    tone="danger"
                    announcement="assertive"
                >
                    Choose an available effort or the Agent default.
                </InlineNotice>}
                {waiting && <p
                    className="controller-runtime-note"
                >
                    Answer the pending canvas question before changing its model. Another Agent opens a separate conversation.
                </p>}
                {(optionsError || message) && <InlineNotice
                    className="rounded-none type-caption"
                    tone={optionsError || failed ? "danger" : "success"}
                    announcement={optionsError || failed ? "assertive" : "polite"}
                >
                    {optionsError || message}
                </InlineNotice>}
                <Row
                    gap={4}
                >
                    <Button
                        className="controller-runtime-tool"
                        variant="quiet"
                        size="small"
                        type="button"
                        disabled={loading || testing || applying}
                        onClick={refreshOptions}
                    >
                        <RefreshCw
                            size={12}
                        />
                        Refresh
                    </Button>
                    <Button
                        className="controller-runtime-tool"
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
                        className="controller-runtime-tool"
                        variant="quiet"
                        size="small"
                        type="button"
                        onClick={() => {

                            close();
                            manage();
                        }}
                    >
                        Manage Agents
                    </Button>
                </Row>
                <p
                    className="controller-runtime-note"
                >
                    Model options are configured locally. Check access sends one short request.
                </p>
            </Stack>
            <Row
                gap={16}
                align="center"
                className="controller-runtime-footer"
            >
                <span
                    className="controller-runtime-context"
                >
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
            </Row>
        </Split>
    </PopoverPanel>;
}
