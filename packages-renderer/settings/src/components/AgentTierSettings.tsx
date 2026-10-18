/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Provider routes behind the three agent tiers
 */

import { AgentTierRouteSettings } from "./AgentTierRouteSettings";
import { IpcError, IpcErrorCode, ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { AgentProviderInstallation, AgentProvidersApi } from "@avesd/desktop-contracts/settings";
import type { AgentTierRoute, AgentTierRoutes, SettingsApi } from "@avesd/desktop-contracts/settings";
import { AGENT_TIERS } from "@avesd/desktop-contracts/settings";
import type { AgentTier } from "@avesd/plugin-api";
import { Button } from "@avesd/ui-controls";
import { Grid, GridItem } from "@avesd/ui-grid";
import { useCallback, useEffect, useRef, useState } from "react";

export function AgentTierSettings({ api, providersApi }: {
    readonly api: SettingsApi;
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
    const [
        revision,
        setRevision,
    ] = useState(0);
    const [
        conflict,
        setConflict,
    ] = useState(false);
    const dirty = useRef(false);
    const loadedRevision = useRef<number | undefined>(undefined);
    const savingRef = useRef(false);
    const reload = useCallback(async () => {

        const snapshot = await api.read();
        setRoutes(snapshot.routes);
        setRevision(snapshot.revision);
        loadedRevision.current = snapshot.revision;
        dirty.current = false;
        setConflict(false);
    }, [api]);
    useEffect(() => {

        let active = true;
        let generation = 0;
        const load = async () => {

            const current = ++generation;
            try {
                const [
                    snapshot,
                    items,
                ] = await Promise.all([
                    api.read(),
                    providersApi.list(),
                ]);
                if (!active || current !== generation) {
                    return;
                }
                setProviders(items);
                if (loadedRevision.current === snapshot.revision) {
                    return;
                }
                if (dirty.current) {
                    setConflict(true);

                    return;
                }
                setRoutes(snapshot.routes);
                setRevision(snapshot.revision);
                loadedRevision.current = snapshot.revision;
            } catch (cause) {
                if (active) {
                    setMessage(ipcErrorMessage(cause, "Settings could not be loaded."));
                }
            }
        };
        void load();
        const unsubscribe = api.subscribe(() => {

            if (!savingRef.current) {
                void load();
            }
        });

        return () => {

            active = false;
            unsubscribe();
        };
    }, [
        api,
        providersApi,
    ]);
    const changeRoute = useCallback((tier: AgentTier, route: AgentTierRoute) => {

        dirty.current = true;
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
        <header
            className="settings-section-heading"
        >
            <p
                className="type-eyebrow text-muted"
            >
                INTELLIGENCE
            </p>
            <h2
                className="type-title"
            >
                Agent tiers
            </h2>
            <p
                className="type-supporting text-muted"
            >
                Choose the models behind your workspace. Changes apply to new conversations.
            </p>
        </header>
        <p
            className="settings-note"
        >
            Model options are configured locally. Listing a model does not guarantee access. Test connection sends a short request and may use provider quota.
        </p>
        {conflict && <div
            role="alert"
        >
            Settings changed in another window. Reload before saving this draft.
            <Button
                variant="secondary"
                onClick={() => {

                    void reload().catch((cause) => {

                        return void setMessage(ipcErrorMessage(cause, "Settings could not be reloaded."));
                    });
                }}
            >
                Reload settings
            </Button>
        </div>}
        <Grid
            columns={{
                base: 1,

            }}
            frame="internal"
            fillLastRow
        >
            {routes && AGENT_TIERS.map(tier => {

                return <GridItem
                    key={tier}
                    padding={24}
                >
                    <AgentTierRouteSettings
                        api={api}
                        tier={tier}
                        providers={providers}
                        route={routes[tier]}
                        saving={saving}
                        onChange={changeRoute}
                        onBlocked={blockRoute}
                    />
                </GridItem>;
            })}
        </Grid>
        <div
            className="settings-save"
        >
            <Button
                size="small"
                disabled={!routes || saving || conflict || Object.values(blocked).some(Boolean)}
                onClick={() => {

                    if (!routes) {
                        return;
                    }
                    setSaving(true);
                    savingRef.current = true;
                    setMessage("");
                    void api.configure(routes, revision).then(async () => {

                        await reload();

                        setMessage("Tier settings saved.");
                    })
                        .catch((cause) => {

                            setConflict(cause instanceof IpcError && cause.code === IpcErrorCode.VersionConflict);
                            setMessage(ipcErrorMessage(cause, "Tier settings could not be saved."));
                        })
                        .finally(() => {

                            savingRef.current = false;
                            setSaving(false);
                        });
                }}
                variant="primary"
            >
                Save agent tiers
            </Button>
            {message && <p
                role="status"
            >
                {message}
            </p>}
        </div>
    </section>;
}
