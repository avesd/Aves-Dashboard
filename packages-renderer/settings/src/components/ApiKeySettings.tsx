/**
 * @author Avesd
 * @package Renderer Settings
 * @namespace Components
 * @description Read-only credential status and provider-specific write-only forms
 */

import { ApiKeyCard } from "./ApiKeyCard";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { ApiKeySnapshot, SettingsApi } from "@avesd/desktop-contracts/settings";
import { Button } from "@avesd/ui-controls";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function ApiKeySettings({ api }: {
    readonly api: SettingsApi;
}) {

    const [
        snapshot,
        setSnapshot,
    ] = useState<ApiKeySnapshot>();
    const [
        error,
        setError,
    ] = useState<string>();
    const [
        loading,
        setLoading,
    ] = useState(true);
    const generation = useRef(0);
    const refresh = useCallback(async () => {

        const current = ++generation.current;
        try {
            const next = await api.apiKeys.read();
            if (current === generation.current) {
                setSnapshot(next);
                setError(undefined);
            }
        } catch (cause) {
            if (current === generation.current) {
                setError(ipcErrorMessage(cause, "API key settings could not be loaded."));
            }
        } finally {
            if (current === generation.current) {
                setLoading(false);
            }
        }
    }, [api.apiKeys]);
    useEffect(() => {

        void refresh();
        const unsubscribe = api.subscribe(() => {

            void refresh();
        });

        return () => {

            generation.current += 1;
            unsubscribe();
        };
    }, [
        api,
        refresh,
    ]);

    return <section
        aria-label="Agent installations"
        aria-busy={loading}
    >
        <header
            className="settings-section-heading"
        >
            <div
                className="settings-section-title"
            >
                <h2
                    className="type-title"
                >
                    Models &amp; services
                </h2>
                <Button
                    variant="secondary"
                    size="small"
                    leading={<RefreshCw
                        size={16}
                    />}
                    onClick={() => {

                        void refresh();
                    }}
                >
                    Refresh
                </Button>
            </div>
            <p
                className="type-supporting text-muted"
            >
                Saved keys apply to new requests immediately.
            </p>
        </header>
        {loading && <p
            className="settings-note"
            role="status"
        >
            Loading API key settings…
        </p>}
        {error && <p
            className="settings-note"
            role="alert"
        >
            {error}
        </p>}
        {snapshot && <>
            {!snapshot.secureStorageAvailable && <p
                className="settings-note"
                role="alert"
            >
                System secure storage is unavailable. Unlock your system keychain to save keys. Keys will never be saved as plain text.
            </p>}
            {snapshot.providers.map(status => {

                return <ApiKeyCard
                    key={status.id}
                    status={status}
                    storageAvailable={snapshot.secureStorageAvailable}
                    api={api.apiKeys}
                    refresh={refresh}
                />;
            })}
        </>}
        <p
            className="settings-note"
        >
            Keys stay encrypted on this device. Existing voice conversations continue until you disconnect. Connection tests check authentication and network access; model permissions, voice access and quota may differ.
        </p>
    </section>;
}
