/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description RuntimeRouteFields
 */

import type { useRuntimePicker } from "./useRuntimePicker";
import { providerSelectOptions, routeSelectOptions } from "@avesd/renderer-agent/route-select-options";
import { Combobox, Select } from "@avesd/ui-controls";

interface Props {
    readonly picker: ReturnType<typeof useRuntimePicker>;
    readonly applying: boolean;
    readonly portalContainer: HTMLElement | null;
}

export function RuntimeRouteFields({ picker, applying, portalContainer }: Props) {

    const { draft, providers, provider, unavailable, loading, options, waiting, defaultModel, defaultEffort, missingModel, chooseProvider, chooseModel, chooseEffort, testing } = picker;
    if (!draft) {
        return null;
    }

    return <fieldset
        className="controller-runtime-fields"
        disabled={applying || testing}
    >
        <label
            className="controller-runtime-field"
        >
            Agent
            <Select
                position="item-aligned"
                controlSize="small"
                autoFocus
                aria-label="Conversation Agent"
                value={draft.providerId}
                disabled={applying || testing}
                portalContainer={portalContainer}
                options={providerSelectOptions(providers, draft.providerId)}
                onValueChange={chooseProvider}
            />
        </label>
        {provider && <p
            className="controller-runtime-status"
        >
            Direct API
            {unavailable ? " · unavailable" : ""}
        </p>}
        <label
            className="controller-runtime-field"
        >
            Model
            <Combobox
                controlSize="small"
                aria-label="Conversation model"
                searchLabel="Search models"
                emptyLabel="No matching models"
                value={draft.modelId}
                disabled={applying || testing || loading || !options || waiting}
                portalContainer={portalContainer}
                options={routeSelectOptions(options?.models, draft.modelId, `Agent default${defaultModel ? ` · ${defaultModel}` : ""}`, "not offered")}
                onValueChange={chooseModel}
            />
        </label>
        <label
            className="controller-runtime-field"
        >
            Effort
            <Select
                position="item-aligned"
                controlSize="small"
                aria-label="Conversation effort"
                value={draft.effortId}
                disabled={applying || testing || loading || !options || !options.efforts.length || missingModel || waiting}
                portalContainer={portalContainer}
                options={routeSelectOptions(options?.efforts, draft.effortId, options && !options.efforts.length ? "Not exposed by this Agent" : `Agent default${defaultEffort ? ` · ${defaultEffort}` : ""}`)}
                onValueChange={chooseEffort}
            />
        </label>
    </fieldset>;
}
