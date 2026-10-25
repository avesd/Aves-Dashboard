/**
 * @author Avesd
 * @package Renderer Agent
 * @namespace Root
 * @description Route choices for shared selection controls
 */

import type { AgentProviderAvailability } from "@avesd/desktop-contracts/settings";

export interface AgentRouteChoice {
    readonly value: string;
    readonly label: string;
    readonly description?: string;
    readonly disabled?: boolean;
}

export function providerSelectOptions(providers: readonly AgentProviderAvailability[], selected: string): AgentRouteChoice[] {

    const choices = providers.map(provider => {

        let availability = "";
        if (!provider.enabled) {
            availability = " · disabled";
        } else if (provider.readiness !== "configured") {
            availability = " · unavailable";
        }

        return {
            value: provider.id,
            label: provider.name + availability,
            disabled: !provider.enabled || provider.readiness !== "configured",
        };
    });
    if (!providers.some(provider => {

        return provider.id === selected;
    })) {
        choices.unshift({
            value: selected,
            label: `${selected} · unavailable`,
            disabled: true,
        });
    }

    return choices;
}

export function routeSelectOptions(items: readonly {
    readonly id: string;
    readonly name: string;
}[] | undefined, selected: string, defaultLabel: string, unavailableLabel = "unavailable"): AgentRouteChoice[] {

    const choices: AgentRouteChoice[] = [
        {
            value: "",
            label: defaultLabel,
        },
    ];
    if (selected && !items?.some(item => {

        return item.id === selected;
    })) {
        choices.push({
            value: selected,
            label: `${selected} · ${unavailableLabel}`,
            disabled: true,
        });
    }
    for (const item of items ?? []) {
        choices.push({
            value: item.id,
            label: item.name,
            ...(item.id !== item.name ? { description: item.id } : {}),
        });
    }

    return choices;
}
