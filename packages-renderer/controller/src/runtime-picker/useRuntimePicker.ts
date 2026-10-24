/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description UseRuntimePicker
 */

import { useControllerApi } from "../controller-context";
import type { RuntimePickerProps } from "./runtime-picker-types";
import type { AgentProviderInstallation } from "@avesd/desktop-contracts/agent/providers";
import type { AgentTierRoute } from "@avesd/desktop-contracts/agent/sessions";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import { useAgentRouteOptions } from "@avesd/renderer-agent/use-agent-route-options";
import { useEffect, useState } from "react";

export function useRuntimePicker({ api, providersApi, session, apply }: RuntimePickerProps) {

    const settings = useControllerApi().settings;
    const [
        open,
        setOpen,
    ] = useState(false);
    const [
        providers,
        setProviders,
    ] = useState<readonly AgentProviderInstallation[]>([]);
    const [
        fallback,
        setFallback,
    ] = useState<AgentTierRoute>();
    const [
        draft,
        setDraft,
    ] = useState<AgentTierRoute>();
    const [
        testing,
        setTesting,
    ] = useState(false);
    const [
        refresh,
        setRefresh,
    ] = useState(0);
    const [
        message,
        setMessage,
    ] = useState<string>();
    const [
        failed,
        setFailed,
    ] = useState(false);
    const selected = session?.settings ? {
        providerId: session.settings.providerId,
        modelId: session.settings.modelId ?? session.route.modelId,
        effortId: session.settings.effortId ?? session.route.effortId,
    } : session?.route ?? fallback;
    const provider = providers.find(item => {

        return item.id === (draft?.providerId ?? selected?.providerId);
    });
    const currentName = providers.find(item => {

        return item.id === selected?.providerId;
    })?.name ?? selected?.providerId ?? "Choose Agent";
    const modelName = session?.settings?.models.find(item => {

        return item.id === selected?.modelId;
    })?.name ?? selected?.modelId ?? "Agent default";
    const effortName = session?.settings?.efforts?.find(item => {

        return item.id === selected?.effortId;
    })?.name ?? selected?.effortId ?? "Default";
    const providerId = draft?.providerId;
    const modelId = draft?.modelId;
    const providerKnown = !!provider;
    const unavailable = !!provider && (!provider.enabled || provider.status !== "installed");
    const { options, loading, error: optionsError, missingModel, missingEffort } = useAgentRouteOptions(api, draft, open && providerKnown && !unavailable, refresh);
    const waiting = !!session?.waitingForAnswer && draft?.providerId === session.route.providerId;
    const close = () => {

        setOpen(false);
    };

    useEffect(() => {

        return settings.subscribe(() => {

            return void setRefresh(value => {

                return value + 1;
            });
        });
    }, [settings]);
    useEffect(() => {

        let active = true;
        void Promise.all([
            providersApi.list(),
            api.routes(),
        ]).then(([
            items,
            routes,
        ]) => {

            if (active) {
                setProviders(items);
                setFallback(routes.flagship);
            }
        })
            .catch((cause) => {

                if (active) {
                    setMessage(ipcErrorMessage(cause, "Agent settings could not be loaded."));
                    setFailed(true);
                }
            });

        return () => {

            active = false;
        };
    }, [
        api,
        providersApi,
        refresh,
        open,
    ]);
    useEffect(() => {

        if (open && providerId && providerKnown && !unavailable) {
            setMessage(undefined);
            setFailed(false);
        }
    }, [
        api,
        open,
        providerId,
        modelId,
        providerKnown,
        unavailable,
        refresh,
    ]);

    const test = async () => {

        if (!draft) {
            return;
        }
        setTesting(true);
        setMessage(undefined);
        setFailed(false);
        try {
            const result = await api.probeRoute(draft, true);
            setFailed(!result.ok);
            setMessage(result.ok ? "Access verified. This model completed a short request." : result.message);
        } catch (cause) {
            setFailed(true);
            setMessage(ipcErrorMessage(cause, "The access check could not run. Please retry."));
        }
        finally {
            setTesting(false);
        }
    };
    const save = async () => {

        if (!draft || !options) {
            return;
        }
        setFailed(false);
        setMessage(undefined);
        try {
            await apply({
                providerId: draft.providerId,
                modelId: draft.modelId || options.defaultModelId || "",
                effortId: draft.effortId || options.defaultEffortId || "",
            });
            close();
        } catch (cause) {
            setFailed(true);
            setMessage(ipcErrorMessage(cause, "Agent selection could not be applied."));
        }
    };
    const initial = () => {

        const value = selected ?? fallback;
        if (value) {
            setDraft(value);
            setMessage(undefined);
            setFailed(false);
            setOpen(true);
        }
    };
    const defaultModel = options?.models.find(item => {

        return item.id === options.defaultModelId;
    })?.name ?? options?.defaultModelId;
    const defaultEffort = options?.efforts.find(item => {

        return item.id === options.defaultEffortId;
    })?.name ?? options?.defaultEffortId;

    return {
        open,
        setOpen,
        draft,
        setDraft,
        providers,
        provider,
        unavailable,
        selected,
        currentName,
        modelName,
        effortName,
        options,
        loading,
        optionsError,
        missingModel,
        missingEffort,
        waiting,
        testing,
        message,
        setMessage,
        failed,
        close,
        initial,
        test,
        save,
        setRefresh,
        defaultModel,
        defaultEffort,
    };
}
