/**
 * @author Avesd
 * @package Renderer Agent
 * @namespace Root
 * @description Use Agent Route Options
 */

import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { AgentRouteOptions, AgentTierRoute, SettingsApi } from "@avesd/desktop-contracts/settings";
import { useEffect, useState } from "react";

/** Lists local model options only; connection tests and applying routes belong to the caller. */
export function useAgentRouteOptions(api: Pick<SettingsApi, "probeRoute">, route: AgentTierRoute | undefined, enabled = true, refresh = 0) {

    const [
        options,
        setOptions,
    ] = useState<AgentRouteOptions>();
    const [
        loading,
        setLoading,
    ] = useState(enabled);
    const [
        error,
        setError,
    ] = useState<string>();
    const providerId = route?.providerId;
    const modelId = route?.modelId ?? "";
    useEffect(() => {

        let active = true;
        setOptions(undefined);
        setError(undefined);
        if (!enabled || !providerId) {
            setLoading(false);

            return;
        }
        setLoading(true);
        void api.probeRoute({
            providerId,
            modelId,
            effortId: "",
        }, false).then(result => {

            if (!active) {
                return;
            }
            if (result.ok) {
                setOptions(result.options);
            }
            else {
                setError(result.message);
            }
        })
            .catch((cause: unknown) => {

                if (active) {
                    setError(ipcErrorMessage(cause, "Model options could not be loaded. Refresh and try again."));
                }
            })
            .finally(() => {

                if (active) {
                    setLoading(false);
                }
            });

        return () => {

            active = false;
        };
    }, [
        api,
        providerId,
        modelId,
        enabled,
        refresh,
    ]);
    const missingModel = !!options && !!route?.modelId && !options.models.some(item => {

        return item.id === route.modelId;
    });
    const missingEffort = !!options && !!route?.effortId && !options.efforts.some(item => {

        return item.id === route.effortId;
    });

    return {
        options,
        loading,
        error,
        missingModel,
        missingEffort,
    };
}
