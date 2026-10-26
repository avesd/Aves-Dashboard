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
import { InlineNotice } from "@avesd/ui-data";
import { Row, Split, Stack } from "@avesd/ui-grid";
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
        <Split
            direction="column"
        >
            <header
                className="settings-section-heading"
            >
                <Stack
                    gap={16}
                >
                    <Row
                        gap={16}
                        align="center"
                        justify="between"
                    >
                        <h2
                            className="type-title"
                        >
                            Models &amp; services
                        </h2>
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {

                                void refresh();
                            }}
                        >
                            <RefreshCw
                                size={16}
                            />
                            Refresh
                        </Button>
                    </Row>
                    <p
                        className="type-supporting text-muted"
                    >
                        Saved keys apply to new requests immediately.
                    </p>
                </Stack>
            </header>
            {loading && <div>
                <InlineNotice
                    announcement="polite"
                >
                    Loading API key settings…
                </InlineNotice>
            </div>}
            {error && <div>
                <InlineNotice
                    tone="danger"
                    announcement="assertive"
                >
                    {error}
                </InlineNotice>
            </div>}
            {snapshot && !snapshot.secureStorageAvailable && <div>
                <InlineNotice
                    tone="danger"
                    announcement="assertive"
                >
                    System secure storage is unavailable. Unlock your system keychain to save keys. Keys will never be saved as plain text.
                </InlineNotice>
            </div>}
            {snapshot?.providers.map(status => {

                return <ApiKeyCard
                    key={status.id}
                    status={status}
                    storageAvailable={snapshot.secureStorageAvailable}
                    api={api.apiKeys}
                    refresh={refresh}
                />;
            })}
            <p
                className="settings-note"
            >
                Keys stay encrypted on this device. Existing voice conversations continue until you disconnect. Connection tests check authentication and network access; model permissions, voice access and quota may differ.
            </p>
        </Split>
    </section>;
}
