/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Provider routes behind the three agent tiers
 */

import type { AgentProviderInstallation, AgentProvidersApi } from "../../../../shared/agent/providers";
import type { AgentSessionsApi, AgentTierRoute, AgentTierRoutes } from "../../../../shared/agent/sessions";
import { AGENT_TIERS } from "../../../../shared/agent/sessions";
import { AgentTierRouteSettings } from "./AgentTierRouteSettings";
import type { AgentTier } from "@avesd/plugin-api";
import { Button } from "@avesd/ui";
import { useCallback, useEffect, useState } from "react";

export function AgentTierSettings({ api, providersApi }: {
    readonly api: Pick<AgentSessionsApi, "routes" | "configure" | "probeRoute">;
    readonly providersApi: Pick<AgentProvidersApi, "list">;
}) {

    const [
        providers,
        setProviders,
    ] = useState<readonly AgentProviderInstallation[]>([]);
    const [
        routes,
        setRoutes,
    ] = useState<AgentTierRoutes>();
    const [
        saving,
        setSaving,
    ] = useState(false);
    const [
        blocked,
        setBlocked,
    ] = useState({
        flagship: true,
        reasoning: true,
        action: true,
    });
    const [
        message,
        setMessage,
    ] = useState("");
    useEffect(() => {

        let active = true;
        void Promise.all([
            api.routes(),
            providersApi.list(),
        ]).then(([
            value,
            items,
        ]) => {

            if (active) {
                setRoutes(value); setProviders(items);
            }
        })
            .catch(() => {

                if (active) {
                    setMessage("Tier settings could not be loaded.");
                }
            });

        return () => {

            active = false;
        };
    }, [
        api,
        providersApi,
    ]);
    const changeRoute = useCallback((tier: AgentTier, route: AgentTierRoute) => {

        setRoutes(current => {

            return current ? {
                ...current,
                [tier]: route,
            } : current;
        });
        setMessage("");
    }, []);
    const blockRoute = useCallback((tier: AgentTier, value: boolean) => {

        setBlocked(current => {

            return current[tier] === value ? current : {
                ...current,
                [tier]: value,
            };
        });
    }, []);

    return <section
        aria-label="Agent tiers"
        className="agent-tier-settings"
    >
        <h3>Agent tiers</h3>
        <p>Widgets choose a tier. Changes apply to new sessions.</p>
        <p>Model options are configured locally. Listing a model does not guarantee access. Test connection sends a short request and may use provider quota.</p>
        {routes && AGENT_TIERS.map(tier => {

            return <AgentTierRouteSettings
                key={tier}
                api={api}
                tier={tier}
                providers={providers}
                route={routes[tier]}
                saving={saving}
                onChange={changeRoute}
                onBlocked={blockRoute}
            />;
        })}
        <Button
            size="small"
            disabled={!routes || saving || Object.values(blocked).some(Boolean)}
            onClick={() => {

                if (!routes) {
                    return;
                }
                setSaving(true); setMessage("");
                void api.configure(routes).then(() => {

                    setMessage("Tier settings saved.");
                })
                    .catch(() => {

                        setMessage("Tier settings could not be saved.");
                    })
                    .finally(() => {

                        setSaving(false);
                    });
            }}
        >
            Save agent tiers
        </Button>
        {message && <p
            role="status"
        >
            {message}
        </p>}
    </section>;
}
