/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent Provider Settings
 */

import type { AgentProviderInstallation, AgentProvidersApi } from "../../../../shared/agent/providers";
import { Button } from "@avesd/ui";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const labels = {
    checking: "Checking…",
    installed: "Configured",
    "not-found": "Key missing",
    error: "Needs attention",
};

export function AgentProviderSettings({ api }: {
    readonly api: AgentProvidersApi;
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
            .catch(() => {

                if (active.current) {
                    setError("Agent installations could not be checked. Try refreshing.");
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

        setBusy(true); setError(undefined);
        try {
            await operation(); const result = await api.list(); if (active.current) {
                setProviders(result);
            }
        }
        catch (cause) {
            if (active.current) {
                setError(cause instanceof Error ? cause.message : "Agent settings could not be updated.");
            }
        }
        finally {
            if (active.current) {
                setBusy(false);
            }
        }
    };

    return <section
        className="agent-installations"
        aria-label="Agent installations"
        aria-busy={busy}
    >
        <div
            className="settings-section-heading"
        >
            <h3>Agent API</h3>
            <Button
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
            </Button>
        </div>
        <p>DeepSeek runs tasks through its API. GPT-Live handles voice separately.</p>
        {busy && providers.length === 0 && <p
            role="status"
        >
            Checking installations…
        </p>}
        {error && <p
            className="settings-error"
            role="alert"
        >
            {error}
        </p>}
        <p
            className="settings-note"
        >
            API keys are loaded in the desktop main process. Restart Avesd after changing local configuration.
        </p>
        {providers.map(provider => {

            return <ProviderCard
                key={provider.id}
                provider={provider}
                disabled={busy}
                openSetup={() => {

                    return run(() => {

                        return api.openSetup(provider.id);
                    });
                }}
            />;
        })}
        <p
            className="settings-note"
        >
            Configuration status only checks whether a key exists. Use Check access in model settings to verify a request.
        </p>
    </section>;
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
            <span
                className={`provider-badge is-${provider.status}`}
            >
                {labels[provider.status]}
            </span>
        </div>
        <p>
            {provider.message}
        </p>
        <Button
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
