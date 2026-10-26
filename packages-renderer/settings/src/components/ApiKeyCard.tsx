/**
 * @author Avesd
 * @package Renderer Settings
 * @namespace Components
 * @description Secret entry, replacement, confirmed deletion and explicit connection tests
 */

import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { ApiKeyProvider, ApiKeysApi, ApiKeyStatus } from "@avesd/desktop-contracts/settings";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPanel, AlertDialogTitle, AlertDialogTrigger, Button, InlineEditor } from "@avesd/ui-controls";
import { DataBadge, InlineNotice } from "@avesd/ui-data";
import { Row, Stack } from "@avesd/ui-grid";
import { useEffect, useRef, useState } from "react";

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
    const editButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {

        mounted.current = true;

        return () => {

            mounted.current = false;
        };
    }, []);
    const close = () => {

        setEditor({ type: "view" });
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
        <Stack
            gap={16}
        >
            <Row
                gap={16}
                align="center"
                justify="between"
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
            </Row>
            {status.message && <InlineNotice
                tone="danger"
                announcement="assertive"
            >
                {status.message}
            </InlineNotice>}
            <Row
                gap={8}
                align="center"
            >
                <InlineEditor
                    className={editor.type === "edit" ? "w-full" : undefined}
                    editing={editor.type === "edit"}
                    onEditingChange={editing => {

                        if (editing) {
                            setFeedback(undefined);
                            setEditor({
                                type: "edit",
                                key: "",
                                revision: status.revision,
                            });
                        } else {
                            close();
                        }
                    }}
                    value={editor.type === "edit" ? editor.key : ""}
                    onValueChange={key => {

                        setEditor(current => {

                            if (current.type !== "edit") {
                                return current;
                            }

                            return {
                                ...current,
                                key,
                            };
                        });
                    }}
                    onSubmit={() => {

                        void run("save");
                    }}
                    busy={busy}
                    disabled={!storageAvailable}
                    submitDisabled={editor.type !== "edit" || !editor.key.trim() || editor.revision !== status.revision}
                    display={null}
                    label={`${provider.name} API key`}
                    editLabel={saved ? "Replace key" : "Add key"}
                    saveLabel="Save key"
                    cancelLabel="Cancel"
                    editButtonProps={{
                        ref: editButton,
                        variant: saved ? "secondary" : "primary",
                        "aria-label": `${saved ? "Replace" : "Add"} ${provider.name} API key`,
                    }}
                    inputProps={{
                        type: "password",
                        autoComplete: "off",
                        spellCheck: false,
                        autoCapitalize: "none",
                        maxLength: 4096,
                        required: true,
                    }}
                    feedback={editor.type === "edit" && editor.revision !== status.revision && <InlineNotice
                        tone="danger"
                        announcement="assertive"
                    >
                        Configuration changed. Cancel and reopen this form before saving.
                    </InlineNotice>}
                />
                {editor.type !== "edit" && <>
                    <Button
                        variant="secondary"
                        size="small"
                        loading={busy}
                        disabled={status.source !== "saved"}
                        aria-label={`Test ${provider.name} connection`}
                        onClick={() => {

                            void run("test");
                        }}
                    >
                        Test connection
                    </Button>
                    <AlertDialog
                        open={editor.type === "delete"}
                        onOpenChange={open => {

                            if (!open && !busy) {
                                close();
                            }
                        }}
                    >
                        {saved && <AlertDialogTrigger
                            asChild
                        >
                            <Button
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
                            </Button>
                        </AlertDialogTrigger>}
                        <AlertDialogPanel
                            onCloseAutoFocus={event => {

                                event.preventDefault();
                                editButton.current?.focus();
                            }}
                            onEscapeKeyDown={event => {

                                if (busy) {
                                    event.preventDefault();
                                }
                            }}
                        >
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {`Delete ${provider.name} API key?`}
                                </AlertDialogTitle>
                                <AlertDialogDescription>New requests will require a new key.</AlertDialogDescription>
                            </AlertDialogHeader>
                            {feedback?.failed && <InlineNotice
                                tone="danger"
                                announcement="assertive"
                            >
                                {feedback.message}
                            </InlineNotice>}
                            <AlertDialogFooter>
                                <AlertDialogCancel
                                    disabled={busy}
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    loading={busy}
                                    onClick={event => {

                                        event.preventDefault();
                                        void run("remove");
                                    }}
                                >
                                    Confirm deletion
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogPanel>
                    </AlertDialog>
                </>}
            </Row>
            {feedback && feedback.revision === status.revision && editor.type !== "delete" && <InlineNotice
                tone={feedback.failed ? "danger" : "success"}
                announcement={feedback.failed ? "assertive" : "polite"}
            >
                {feedback.message}
            </InlineNotice>}
        </Stack>
    </article>;
}
