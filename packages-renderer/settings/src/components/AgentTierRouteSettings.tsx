/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent-sourced model choices and explicit route verification
 */

import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { AgentProviderAvailability } from "@avesd/desktop-contracts/settings";
import type { AgentTierRoute, SettingsApi } from "@avesd/desktop-contracts/settings";
import { agentTierLabels } from "@avesd/desktop-contracts/settings";
import type { AgentTier } from "@avesd/plugin-api";
import { providerSelectOptions, routeSelectOptions } from "@avesd/renderer-agent/route-select-options";
import { useAgentRouteOptions } from "@avesd/renderer-agent/use-agent-route-options";
import { Button, Combobox, Field, FieldNote, Fieldset, Label, Select } from "@avesd/ui-controls";
import { InlineNotice } from "@avesd/ui-data";
import { Row, Stack } from "@avesd/ui-grid";
import { useEffect, useId, useState } from "react";

export function AgentTierRouteSettings({ api, tier, route, providers, saving, onChange, onBlocked }: {
    readonly api: Pick<SettingsApi, "probeRoute">;
    readonly tier: AgentTier;
    readonly providers: readonly AgentProviderAvailability[];
    readonly route: AgentTierRoute;
    readonly saving: boolean;
    readonly onChange: (tier: AgentTier, route: AgentTierRoute) => void;
    readonly onBlocked: (tier: AgentTier, blocked: boolean) => void;
}) {

    const id = useId();
    const [
        testing,
        setTesting,
    ] = useState(false);
    const [
        refresh,
        setRefresh,
    ] = useState(0);
    const [
        result,
        setResult,
    ] = useState<{
        key: string;
        message: string;
        failed: boolean;
    }>();
    const key = JSON.stringify(route);
    const label = agentTierLabels[tier];
    const { options, loading, error, missingModel, missingEffort } = useAgentRouteOptions(api, route, true, refresh);
    useEffect(() => {

        setResult(undefined);
    }, [
        api,
        route.providerId,
        route.modelId,
        route.effortId,
        refresh,
    ]);

    useEffect(() => {

        onBlocked(tier, loading || testing || missingModel || missingEffort);
    }, [
        onBlocked,
        tier,
        loading,
        testing,
        missingModel,
        missingEffort,
    ]);

    const testConnection = async () => {

        setTesting(true);
        setResult(undefined);
        try {
            const response = await api.probeRoute(route, true);
            setResult({
                key,
                failed: !response.ok,
                message: response.ok
                    ? `Test passed · ${response.options.models.find(item => {

                        return item.id === response.options.modelId;
                    })?.name ?? response.options.modelId ?? "Agent default model"}`
                    : response.message,
            });
        } catch (cause) {
            setResult({
                key,
                failed: true,
                message: ipcErrorMessage(cause, "The connection test could not run. Check this Agent and retry."),
            });
        }
        finally {
            setTesting(false);
        }
    };
    const defaultModel = options?.models.find(item => {

        return item.id === options.defaultModelId;
    })?.name ?? options?.defaultModelId;
    const defaultEffort = options?.efforts.find(item => {

        return item.id === options.defaultEffortId;
    })?.name ?? options?.defaultEffortId;

    return <Fieldset
        disabled={saving || loading || testing}
        aria-busy={loading || testing}
    >
        <legend
            className="type-subheading"
        >
            {label}
        </legend>
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
                    id={`${id}-agent`}
                    aria-label={`${label} Agent`}
                    value={route.providerId}
                    disabled={saving || loading || testing}
                    options={providerSelectOptions(providers, route.providerId)}
                    onValueChange={providerId => {

                        onChange(tier, {
                            providerId,
                            modelId: "",
                            effortId: "",
                        });
                    }}
                />
            </Field>
            <Field>
                <Label
                    htmlFor={`${id}-model`}
                >
                    Model
                </Label>
                <Combobox
                    controlSize="small"
                    id={`${id}-model`}
                    aria-label={`${label} model`}
                    aria-invalid={missingModel || undefined}
                    aria-describedby={missingModel ? `${id}-model-note` : undefined}
                    searchLabel={`Search ${label} models`}
                    emptyLabel="No matching models"
                    value={route.modelId}
                    disabled={saving || loading || testing || !options}
                    options={routeSelectOptions(options?.models, route.modelId, `Use Agent default${defaultModel ? ` (${defaultModel})` : ""}`, options ? "Not offered by Agent" : "Saved selection")}
                    onValueChange={modelId => {

                        onChange(tier, {
                            ...route,
                            modelId,
                            effortId: "",
                        });
                    }}
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
                    aria-label={`${label} effort`}
                    aria-invalid={missingEffort || undefined}
                    aria-describedby={missingEffort && !missingModel ? `${id}-effort-note` : undefined}
                    value={route.effortId}
                    disabled={saving || loading || testing || !options || missingModel || (!options.efforts.length && !route.effortId)}
                    options={routeSelectOptions(options?.efforts, route.effortId, `Use Agent default${defaultEffort ? ` (${defaultEffort})` : ""}`, options ? "Not offered by Agent" : "Saved selection")}
                    onValueChange={effortId => {

                        onChange(tier, {
                            ...route,
                            effortId,
                        });
                    }}
                />
            </Field>
            <Row
                gap={8}
                className="agent-tier-actions"
            >
                <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {

                        return void setRefresh(value => {

                            return value + 1;
                        });
                    }}
                    aria-label={`Refresh ${label} models`}
                >
                    Refresh models
                </Button>
                <Button
                    variant="secondary"
                    size="small"
                    disabled={!options || missingModel || missingEffort}
                    onClick={() => {

                        return void testConnection();
                    }}
                    aria-label={`Test ${label} connection`}
                >
                    {testing ? "Testing…" : "Test connection"}
                </Button>
            </Row>
            {loading && <InlineNotice
                announcement="polite"
            >
                Loading Agent options…
            </InlineNotice>}
            {error && <InlineNotice
                tone="danger"
                announcement="assertive"
            >
                {error}
            </InlineNotice>}
            {missingModel && <FieldNote
                id={`${id}-model-note`}
                invalid
                role="alert"
            >
                The saved model is no longer offered. Choose another model or use the Agent default.
            </FieldNote>}
            {missingEffort && !missingModel && <FieldNote
                id={`${id}-effort-note`}
                invalid
                role="alert"
            >
                The saved effort is unavailable for this model. Choose another effort or its default.
            </FieldNote>}
            {options && !loading && !options.models.length && <FieldNote>
                This Agent did not report model options. You can still test its default.
            </FieldNote>}
            {result?.key === key && <InlineNotice
                tone={result.failed ? "danger" : "success"}
                announcement={result.failed ? "assertive" : "polite"}
            >
                {result.message}
            </InlineNotice>}
        </Stack>
    </Fieldset>;
}
