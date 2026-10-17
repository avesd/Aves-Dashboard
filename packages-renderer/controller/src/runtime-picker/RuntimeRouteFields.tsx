/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description RuntimeRouteFields
 */

import type { useRuntimePicker } from "./useRuntimePicker";
import type { AgentProviderInstallation } from "@avesd/desktop-contracts/agent/providers";
import { providerSelectOptions, routeSelectOptions } from "@avesd/renderer-agent/route-select-options";
import { Combobox, Select } from "@avesd/ui-controls";

const providerSourceLabels: Record<AgentProviderInstallation["source"], string> = {
    api: "Direct API",
    bundled: "Bundled runtime",
    custom: "Custom runtime",
    system: "Local installation",
};
interface Props {
    readonly picker: ReturnType<typeof useRuntimePicker>;
    readonly applying: boolean;
}

export function RuntimeRouteFields({ picker, applying }: Props) {

    const { draft, providers, provider, unavailable, loading, options, waiting, defaultModel, defaultEffort, missingModel, setDraft, setMessage, testing, container } = picker;
    if (!draft) {
        return null;
    }

    return <fieldset
        disabled={applying || testing}
    >
        <label>
            Agent
            <Select
                controlSize="small"
                autoFocus
                aria-label="Conversation Agent"
                value={draft.providerId}
                disabled={applying || testing}
                portalContainer={container.current}
                options={providerSelectOptions(providers, draft.providerId)}
                onValueChange={providerId => {

                    setDraft({
                        providerId,
                        modelId: "",
                        effortId: "",
                    });
                    setMessage(undefined);
                }}
            />
        </label>
        {provider && <p
            className="controller-runtime-status"
        >
            {providerSourceLabels[provider.source]}
            {provider.version ? ` · v${provider.version}` : ""}
            {unavailable ? " · unavailable" : ""}
        </p>}
        <label>
            Model
            <Combobox
                controlSize="small"
                aria-label="Conversation model"
                searchLabel="Search models"
                emptyLabel="No matching models"
                value={draft.modelId}
                disabled={applying || testing || loading || !options || waiting}
                portalContainer={container.current}
                options={routeSelectOptions(options?.models, draft.modelId, `Agent default${defaultModel ? ` · ${defaultModel}` : ""}`, "not offered")}
                onValueChange={modelId => {

                    setDraft({
                        ...draft,
                        modelId,
                        effortId: "",
                    });
                    setMessage(undefined);
                }}
            />
        </label>
        <label>
            Effort
            <Select
                controlSize="small"
                aria-label="Conversation effort"
                value={draft.effortId}
                disabled={applying || testing || loading || !options || !options.efforts.length || missingModel || waiting}
                portalContainer={container.current}
                options={routeSelectOptions(options?.efforts, draft.effortId, options && !options.efforts.length ? "Not exposed by this Agent" : `Agent default${defaultEffort ? ` · ${defaultEffort}` : ""}`)}
                onValueChange={effortId => {

                    setDraft({
                        ...draft,
                        effortId,
                    });
                    setMessage(undefined);
                }}
            />
        </label>
    </fieldset>;
}
