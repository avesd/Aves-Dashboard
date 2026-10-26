/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description RuntimeRouteFields
 */

import type { useRuntimePicker } from "./useRuntimePicker";
import { providerSelectOptions, routeSelectOptions } from "@avesd/renderer-agent/route-select-options";
import { Combobox, Field, FieldNote, Fieldset, Label, Select } from "@avesd/ui-controls";
import { Stack } from "@avesd/ui-grid";
import { useId } from "react";

interface Props {
    readonly picker: ReturnType<typeof useRuntimePicker>;
    readonly applying: boolean;
    readonly portalContainer: HTMLElement | null;
}

export function RuntimeRouteFields({ picker, applying, portalContainer }: Props) {

    const id = useId();
    const { draft, providers, provider, unavailable, loading, options, waiting, defaultModel, defaultEffort, missingModel, chooseProvider, chooseModel, chooseEffort, testing } = picker;
    if (!draft) {
        return null;
    }

    return <Fieldset
        disabled={applying || testing}
    >
        <Stack
            gap={16}
        >
            <Field>
                <Label
                    htmlFor={`${id}-agent`}
                >
                    Agent
                </Label>
                <Select
                    position="item-aligned"
                    controlSize="small"
                    autoFocus
                    id={`${id}-agent`}
                    aria-label="Conversation Agent"
                    value={draft.providerId}
                    disabled={applying || testing}
                    portalContainer={portalContainer}
                    options={providerSelectOptions(providers, draft.providerId)}
                    onValueChange={chooseProvider}
                />
            </Field>
            {provider && <FieldNote
                className="type-caption"
            >
                Direct API
                {unavailable ? " · unavailable" : ""}
            </FieldNote>}
            <Field>
                <Label
                    htmlFor={`${id}-model`}
                >
                    Model
                </Label>
                <Combobox
                    controlSize="small"
                    id={`${id}-model`}
                    aria-label="Conversation model"
                    searchLabel="Search models"
                    emptyLabel="No matching models"
                    value={draft.modelId}
                    disabled={applying || testing || loading || !options || waiting}
                    portalContainer={portalContainer}
                    options={routeSelectOptions(options?.models, draft.modelId, `Agent default${defaultModel ? ` · ${defaultModel}` : ""}`, "not offered")}
                    onValueChange={chooseModel}
                />
            </Field>
            <Field>
                <Label
                    htmlFor={`${id}-effort`}
                >
                    Effort
                </Label>
                <Select
                    position="item-aligned"
                    controlSize="small"
                    id={`${id}-effort`}
                    aria-label="Conversation effort"
                    value={draft.effortId}
                    disabled={applying || testing || loading || !options || !options.efforts.length || missingModel || waiting}
                    portalContainer={portalContainer}
                    options={routeSelectOptions(options?.efforts, draft.effortId, options && !options.efforts.length ? "Not exposed by this Agent" : `Agent default${defaultEffort ? ` · ${defaultEffort}` : ""}`)}
                    onValueChange={chooseEffort}
                />
            </Field>
        </Stack>
    </Fieldset>;
}
