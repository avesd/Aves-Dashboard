/**
 * @author Avesd
 * @package Renderer Settings
 * @namespace Components
 * @description Secret entry, replacement, confirmed deletion and explicit connection tests
 */

import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { ApiKeyProvider, ApiKeysApi, ApiKeyStatus } from "@avesd/desktop-contracts/settings";
import { Button, Input } from "@avesd/ui-controls";
import { DataBadge } from "@avesd/ui-data";
import { useEffect, useId, useRef, useState } from "react";

const providers: Record<ApiKeyProvider, {
    name: string;
    description: string;
}> = {
    deepseek: {
        name: "DeepSeek",
        description: "Agent reasoning and workspace tasks",
    },
    openai: {
        name: "OpenAI",
        description: "Realtime voice conversations",
    },
};
const statusLabels: Record<ApiKeyStatus["source"], string> = {
    saved: "Configured",
    missing: "Not configured",
    unavailable: "Unavailable",
};
type Editor = {
    type: "view";
} | {
    type: "edit";
    key: string;
    revision: number;
} | {
    type: "delete";
    revision: number;
};

export function ApiKeyCard({ status, storageAvailable, api, refresh }: {
    readonly status: ApiKeyStatus;
    readonly storageAvailable: boolean;
    readonly api: ApiKeysApi;
    readonly refresh: () => Promise<void>;
}) {

    const provider = providers[status.id];
    const inputId = useId();
    const [
        editor,
        setEditor,
    ] = useState<Editor>({ type: "view" });
    const [
        busy,
        setBusy,
    ] = useState(false);
    const [
        feedback,
        setFeedback,
    ] = useState<{
        revision: number;
        message: string;
        failed: boolean;
    }>();
    const mounted = useRef(true);
    const pending = useRef(false);
    const input = useRef<HTMLInputElement>(null);
    const editButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {

        mounted.current = true;

        return () => {

            mounted.current = false;
        };
    }, []);
    useEffect(() => {

        if (editor.type === "edit") {
            input.current?.focus();
        }
    }, [editor.type]);
    const close = () => {

        setEditor({ type: "view" });
        requestAnimationFrame(() => {

            editButton.current?.focus();
        });
    };
    const run = async (operation: "save" | "remove" | "test") => {

        if (pending.current) {
            return;
        }
        pending.current = true;
        setBusy(true);
        setFeedback(undefined);
        let revision = status.revision;
        try {
            let message: string;
            let failed = false;
            if (operation === "save" && editor.type === "edit") {
                revision = editor.revision;
                const key = editor.key;
                setEditor({
                    ...editor,
                    key: "",
                });
                await api.save(status.id, key, revision);
                revision += 1;
                message = "API key saved. New requests use it immediately.";
            } else if (operation === "remove" && editor.type === "delete") {
                revision = editor.revision;
                await api.remove(status.id, revision);
                revision += 1;
                message = "Saved API key deleted.";
            } else if (operation === "test") {
                const result = await api.test(status.id, revision);
                message = result.message;
                failed = !result.ok;
            } else {
                return;
            }
            if (mounted.current) {
                close();
                setFeedback({
                    revision,
                    message,
                    failed,
                });
            }
        } catch (cause) {
            if (mounted.current) {
                setFeedback({
                    revision: status.revision,
                    message: ipcErrorMessage(cause, "The API key operation failed. Try again."),
                    failed: true,
                });
            }
        } finally {
            await refresh();
            pending.current = false;
            if (mounted.current) {
                setBusy(false);
            }
        }
    };
    const saved = status.hasSavedKey || status.source === "unavailable";

    return <article
        className="api-key-card"
        aria-label={provider.name}
        aria-busy={busy}
    >
        <div
            className="provider-card-heading"
        >
            <div>
                <h3
                    className="type-subheading"
                >
                    {provider.name}
                </h3>
                <p
                    className="type-supporting text-muted"
                >
                    {provider.description}
                </p>
            </div>
            <DataBadge
                tone={status.source === "saved" ? "accent" : "neutral"}
            >
                {statusLabels[status.source]}
            </DataBadge>
        </div>
        {status.message && <p
            role="alert"
            className="type-supporting"
        >
            {status.message}
        </p>}
        {editor.type === "view" && <div
            className="api-key-actions"
        >
            <Button
                ref={editButton}
                variant={saved ? "secondary" : "primary"}
                size="small"
                disabled={busy || !storageAvailable}
                aria-label={`${saved ? "Replace" : "Add"} ${provider.name} API key`}
                onClick={() => {

                    setFeedback(undefined);
                    setEditor({
                        type: "edit",
                        key: "",
                        revision: status.revision,
                    });
                }}
            >
                {saved ? "Replace key" : "Add key"}
            </Button>
            <Button
                variant="secondary"
                size="small"
                disabled={busy || status.source !== "saved"}
                aria-label={`Test ${provider.name} connection`}
                onClick={() => {

                    void run("test");
                }}
            >
                {busy ? "Working…" : "Test connection"}
            </Button>
            {saved && <Button
                variant="quiet"
                size="small"
                disabled={busy}
                aria-label={`Delete ${provider.name} API key`}
                onClick={() => {

                    setFeedback(undefined);
                    setEditor({
                        type: "delete",
                        revision: status.revision,
                    });
                }}
            >
                Delete key
            </Button>}
        </div>}
        {editor.type === "edit" && <form
            className="api-key-editor"
            onSubmit={event => {

                event.preventDefault();
                void run("save");
            }}
        >
            <label
                htmlFor={inputId}
                className="type-ui"
            >
                {provider.name}
                {" "}
                API key
            </label>
            <Input
                ref={input}
                id={inputId}
                type="password"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                maxLength={4096}
                value={editor.key}
                disabled={busy}
                required
                onChange={event => {

                    setEditor({
                        ...editor,
                        key: event.target.value,
                    });
                }}
            />
            <div
                className="api-key-actions"
            >
                <Button
                    type="submit"
                    size="small"
                    disabled={busy || !editor.key.trim() || !storageAvailable}
                >
                    Save key
                </Button>
                <Button
                    variant="secondary"
                    size="small"
                    disabled={busy}
                    onClick={close}
                >
                    Cancel
                </Button>
            </div>
            {editor.revision !== status.revision && <p
                className="type-supporting"
                role="alert"
            >
                Configuration changed. Cancel and reopen this form before saving.
            </p>}
        </form>}
        {editor.type === "delete" && <div
            className="api-key-editor"
        >
            <p
                className="type-supporting"
            >
                Delete the saved
                {" "}
                {provider.name}
                {" "}
                API key? New requests will require a new key.
            </p>
            <div
                className="api-key-actions"
            >
                <Button
                    variant="secondary"
                    size="small"
                    disabled={busy}
                    onClick={() => {

                        void run("remove");
                    }}
                >
                    Confirm deletion
                </Button>
                <Button
                    variant="quiet"
                    size="small"
                    disabled={busy}
                    onClick={close}
                >
                    Cancel
                </Button>
            </div>
        </div>}
        {feedback && feedback.revision === status.revision && <p
            className="type-supporting"
            role={feedback.failed ? "alert" : "status"}
        >
            {feedback.message}
        </p>}
    </article>;
}
