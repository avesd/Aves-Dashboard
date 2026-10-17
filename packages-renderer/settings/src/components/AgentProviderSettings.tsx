/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent Provider Settings
 */

import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { AgentProviderInstallation, AgentProvidersApi } from "@avesd/desktop-contracts/settings";
import { Button } from "@avesd/ui-controls";
import { DataBadge } from "@avesd/ui-data";
import { FrameSection, Grid, GridItem } from "@avesd/ui-grid";
import { SectionHeading } from "@avesd/ui-layout";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const labels = {
    checking: "Checking…",
    installed: "Configured",
    "not-found": "Key missing",
    error: "Needs attention",
};

export function AgentProviderSettings({ api }: {
    readonly api: Pick<AgentProvidersApi, "list" | "openSetup">;
}) {

    const [
        providers,
        setProviders,
    ] = useState<readonly AgentProviderInstallation[]>([]);
    const [
        busy,
        setBusy,
    ] = useState(true);
    const [
        error,
        setError,
    ] = useState<string>();
    const active = useRef(true);
    useEffect(() => {

        active.current = true;
        void api.list(true).then(value => {

            if (active.current) {
                setProviders(value);
            }
        })
            .catch((cause) => {

                if (active.current) {
                    setError(ipcErrorMessage(cause, "Agent installations could not be checked. Try refreshing."));
                }
            })
            .finally(() => {

                if (active.current) {
                    setBusy(false);
                }
            });

        return () => {

            active.current = false;
        };
    }, [api]);
    const run = async (operation: () => Promise<void>) => {

        setBusy(true);
        setError(undefined);
        try {
            await operation();
            const result = await api.list();
            if (active.current) {
                setProviders(result);
            }
        }
        catch (cause) {
            if (active.current) {
                setError(ipcErrorMessage(cause, "Agent settings could not be updated."));
            }
        }
        finally {
            if (active.current) {
                setBusy(false);
            }
        }
    };

    return <FrameSection
        decoration="none"
        className="agent-installations"
        aria-label="Agent installations"
        aria-busy={busy}
    >
        <SectionHeading
            eyebrow="01 / CONNECTIONS"
            title="Agent API"
            description="DeepSeek runs tasks through its API. GPT-Live handles voice separately."
            actions={            <Button
                variant="secondary"
                size="small"
                disabled={busy}
                leading={<RefreshCw
                    size={13}
                />}
                onClick={() => {

                    return void run(async () => {

                        await api.list(true);
                    });
                }}
            >
                Refresh
            </Button>}
        />
        {busy && providers.length === 0 && <p
            className="settings-note"
            role="status"
        >
            Checking installations…
        </p>}
        {error && <p
            className="settings-note settings-error"
            role="alert"
        >
            {error}
        </p>}
        <p
            className="settings-note"
        >
            API keys are loaded in the desktop main process. Restart Avesd after changing local configuration.
        </p>
        <Grid
            columns={{
                base: 1,
                md: 2,
            }}
            frame="internal"
            fillLastRow
        >
            {providers.map(provider => {

                return <GridItem
                    key={provider.id}
                    padding={24}
                >
                    <ProviderCard
                        provider={provider}
                        disabled={busy}
                        openSetup={() => {

                            return run(() => {

                                return api.openSetup(provider.id);
                            });
                        }}
                    />
                </GridItem>;
            })}
        </Grid>
        <p
            className="settings-note"
        >
            Configuration status only checks whether a key exists. Use Check access in model settings to verify a request.
        </p>
    </FrameSection>;
}

function ProviderCard({ provider, disabled, openSetup }: {
    readonly provider: AgentProviderInstallation;
    readonly disabled: boolean;
    readonly openSetup: () => Promise<void>;
}) {

    return <article
        className="provider-card"
        aria-label={provider.name}
    >
        <div
            className="provider-card-heading"
        >
            <strong>
                {provider.name}
            </strong>
            <span>Direct API</span>
        </div>
        <div
            className="provider-status-line"
        >
            <DataBadge
                tone={provider.status === "installed" ? "accent" : "neutral"}
            >
                {labels[provider.status]}
            </DataBadge>
        </div>
        <p>
            {provider.message}
        </p>
        <Button
            variant="secondary"
            size="small"
            disabled={disabled}
            leading={<ExternalLink
                size={12}
            />}
            onClick={() => {

                void openSetup();
            }}
        >
            API setup guide
        </Button>
    </article>;
}
