import type { AgentProviderInstallation, AgentProvidersApi } from "../../../shared/agent/providers";
import type { AgentRouteOptions, AgentSessionsApi, AgentSessionSnapshot, AgentTierRoute } from "../../../shared/agent/sessions";
import { ChevronDown, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
    readonly api: AgentSessionsApi;
    readonly providersApi: AgentProvidersApi;
    readonly session: AgentSessionSnapshot | null;
    readonly disabled: boolean;
    readonly applying: boolean;
    readonly apply: (route: AgentTierRoute) => Promise<void>;
    readonly newConversation: () => void;
    readonly manage: () => void;
}

/** Everyday selection belongs beside the message, installation details belong in Settings. */
export function AgentRuntimePicker({ api, providersApi, session, disabled, applying, apply, newConversation, manage }: Props) {

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
        options,
        setOptions,
    ] = useState<AgentRouteOptions>();
    const [
        loading,
        setLoading,
    ] = useState(false);
    const [
        testing,
        setTesting,
    ] = useState(false);
    const [
        refresh,
        setRefresh,
    ] = useState(0);
    const [
        search,
        setSearch,
    ] = useState("");
    const [
        message,
        setMessage,
    ] = useState<string>();
    const [
        failed,
        setFailed,
    ] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
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
    const missingModel = !!options && !!draft?.modelId && !options.models.some(item => {

        return item.id === draft.modelId;
    });
    const missingEffort = !!options && !!draft?.effortId && !options.efforts.some(item => {

        return item.id === draft.effortId;
    });
    const waiting = !!session?.waitingForAnswer && draft?.providerId === session.route.providerId;
    const close = () => {

        setOpen(false); trigger.current?.focus();
    };

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
                setProviders(items); setFallback(routes.flagship);
            }
        })
            .catch(() => {

                if (active) {
                    setMessage("Agent settings could not be loaded."); setFailed(true);
                }
            });

        return () => {

            active = false;
        };
    }, [
        api,
        providersApi,
        open,
    ]);
    useEffect(() => {

        if (!open) {
            return;
        }
        const outside = (event: PointerEvent) => {

            if (!container.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", outside);

        return () => {

            document.removeEventListener("pointerdown", outside);
        };
    }, [open]);
    useEffect(() => {

        let active = true;
        if (!open || !providerId || !providerKnown || unavailable) {
            setOptions(undefined); setLoading(false);

            return;
        }
        setLoading(true); setOptions(undefined); setMessage(undefined); setFailed(false);
        void api.probeRoute({
            providerId,
            modelId: modelId ?? "",
            effortId: "",
        }, false).then(result => {

            if (!active) {
                return;
            }
            if (result.ok) {
                setOptions(result.options);
            }
            else {
                setMessage(result.message); setFailed(true);
            }
        })
            .catch(() => {

                if (active) {
                    setMessage("Could not load this Agent's models. Refresh or check its installation."); setFailed(true);
                }
            })
            .finally(() => {

                if (active) {
                    setLoading(false);
                }
            });

        return () => {

            active = false;
        };
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
        setTesting(true); setMessage(undefined); setFailed(false);
        try {
            const result = await api.probeRoute(draft, true);
            setFailed(!result.ok); setMessage(result.ok ? "Access verified. This model completed a short request." : result.message);
        } catch { setFailed(true); setMessage("The access check could not run. Please retry."); }
        finally { setTesting(false); }
    };
    const save = async () => {

        if (!draft || !options) {
            return;
        }
        setFailed(false); setMessage(undefined);
        try {
            await apply({
                providerId: draft.providerId,
                modelId: draft.modelId || options.defaultModelId || "",
                effortId: draft.effortId || options.defaultEffortId || "",
            });
            close();
        } catch (cause) { setFailed(true); setMessage(cause instanceof Error ? cause.message : "Agent selection could not be applied."); }
    };
    const initial = () => {

        const value = selected ?? fallback;
        if (value) {
            setDraft(value); setSearch(""); setMessage(undefined); setFailed(false); setOpen(true);
        }
    };
    const defaultModel = options?.models.find(item => {

        return item.id === options.defaultModelId;
    })?.name ?? options?.defaultModelId;
    const defaultEffort = options?.efforts.find(item => {

        return item.id === options.defaultEffortId;
    })?.name ?? options?.defaultEffortId;
    const modelOptions = options?.models.filter(item => {

        return !search || `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase());
    }) ?? [];

    return <div
        className="controller-runtime"
        ref={container}
    >
        <button
            ref={trigger}
            type="button"
            className="controller-runtime-trigger"
            aria-label="Choose Agent, model and effort"
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={disabled || applying || !selected}
            onClick={() => {

                if (open) {
                    close();
                } else {
                    initial();
                }
            }}
        >
            <span
                className="controller-runtime-provider"
            >
                {currentName}
            </span>
            <span
                className="controller-runtime-model"
                title={modelName}
            >
                {modelName || "Agent default"}
            </span>
            <span
                className="controller-runtime-effort"
            >
                {effortName || "Default"}
            </span>
            <ChevronDown
                size={12}
                aria-hidden="true"
            />
        </button>
        <button
            type="button"
            className="controller-runtime-new"
            aria-label="New conversation"
            title="New conversation"
            disabled={disabled || applying}
            onClick={newConversation}
        >
            <Plus
                size={16}
            />
        </button>
        {open && draft && <section
            className="controller-runtime-popover"
            role="dialog"
            aria-label="Agent configuration"
            onKeyDown={event => {

                if (event.key === "Escape") {
                    event.preventDefault(); event.stopPropagation(); close();
                }
            }}
        >
            <header>
                <div>
                    <strong>Choose your agent</strong>
                    <span>Agent · model · reasoning effort</span>
                </div>
                <button
                    type="button"
                    aria-label="Close agent configuration"
                    onClick={close}
                >
                    <X
                        size={16}
                    />
                </button>
            </header>
            <fieldset
                disabled={applying || testing}
            >
                <label>
                    Agent
                    <select
                        autoFocus
                        aria-label="Conversation Agent"
                        value={draft.providerId}
                        onChange={event => {

                            setDraft({
                                providerId: event.target.value,
                                modelId: "",
                                effortId: "",
                            }); setSearch(""); setMessage(undefined);
                        }}
                    >
                        {!providers.some(item => {

                            return item.id === draft.providerId;
                        }) && <option
                            value={draft.providerId}
                        >
                            {draft.providerId}
                            {" "}
                            · unavailable
                        </option>}
                        {providers.map(item => {

                            return <option
                                key={item.id}
                                value={item.id}
                                disabled={!item.enabled || item.status !== "installed"}
                            >
                                {item.name}
                                {!item.enabled ? " · disabled" : item.status !== "installed" ? " · not available" : ""}
                            </option>;
                        })}
                    </select>
                </label>
                {provider && <p
                    className="controller-runtime-status"
                >
                    {provider.source === "api" ? "Direct API" : provider.source === "bundled" ? "Bundled runtime" : provider.source === "custom" ? "Custom runtime" : "Local installation"}
                    {provider.version ? ` · v${provider.version}` : ""}
                    {unavailable ? " · unavailable" : ""}
                </p>}
                <label>
                    Model
                    <select
                        aria-label="Conversation model"
                        value={draft.modelId}
                        disabled={loading || !options || waiting}
                        onChange={event => {

                            setDraft({
                                ...draft,
                                modelId: event.target.value,
                                effortId: "",
                            }); setMessage(undefined);
                        }}
                    >
                        <option
                            value=""
                        >
                            Agent default
                            {defaultModel ? ` · ${defaultModel}` : ""}
                        </option>
                        {draft.modelId && !modelOptions.some(item => {

                            return item.id === draft.modelId;
                        }) && <option
                            value={draft.modelId}
                        >
                            {draft.modelId}
                            {missingModel ? " · not offered" : ""}
                        </option>}
                        {modelOptions.map(item => {

                            return <option
                                key={item.id}
                                value={item.id}
                            >
                                {item.name}
                            </option>;
                        })}
                    </select>
                </label>
                {(options?.models.length ?? 0) > 8 && <input
                    type="search"
                    aria-label="Search models"
                    placeholder="Filter models…"
                    value={search}
                    onChange={event => {

                        setSearch(event.target.value);
                    }}
                />}
                <label>
                    Effort
                    <select
                        aria-label="Conversation effort"
                        value={draft.effortId}
                        disabled={loading || !options || !options.efforts.length || missingModel || waiting}
                        onChange={event => {

                            setDraft({
                                ...draft,
                                effortId: event.target.value,
                            }); setMessage(undefined);
                        }}
                    >
                        <option
                            value=""
                        >
                            {options && !options.efforts.length ? "Not exposed by this Agent" : `Agent default${defaultEffort ? ` · ${defaultEffort}` : ""}`}
                        </option>
                        {missingEffort && <option
                            value={draft.effortId}
                        >
                            {draft.effortId}
                            {" "}
                            · unavailable
                        </option>}
                        {options?.efforts.map(item => {

                            return <option
                                key={item.id}
                                value={item.id}
                            >
                                {item.name}
                            </option>;
                        })}
                    </select>
                </label>
            </fieldset>
            {loading && <p
                role="status"
            >
                Loading models from Agent…
            </p>}
            {missingModel && <p
                role="alert"
            >
                Choose an offered model or the Agent default.
            </p>}
            {missingEffort && <p
                role="alert"
            >
                Choose an available effort or the Agent default.
            </p>}
            {waiting && <p
                className="controller-runtime-note"
            >
                Answer the pending canvas question before changing its model. Another Agent opens a separate conversation.
            </p>}
            {message && <p
                className={failed ? "controller-runtime-failure" : "controller-runtime-success"}
                role={failed ? "alert" : "status"}
            >
                {message}
            </p>}
            <div
                className="controller-runtime-tools"
            >
                <button
                    type="button"
                    disabled={loading || testing || applying}
                    onClick={() => {

                        setRefresh(value => {

                            return value + 1;
                        });
                    }}
                >
                    <RefreshCw
                        size={12}
                    />
                    Refresh
                </button>
                <button
                    type="button"
                    disabled={!options || loading || testing || applying || missingModel || missingEffort}
                    onClick={() => {

                        void test();
                    }}
                >
                    {testing ? "Checking…" : "Check access"}
                </button>
                <button
                    type="button"
                    onClick={() => {

                        setOpen(false); manage();
                    }}
                >
                    Manage Agents
                </button>
            </div>
            <p
                className="controller-runtime-note"
            >
                Model options are configured locally. Check access sends one short request.
            </p>
            <footer>
                <span>
                    {session && session.route.providerId !== draft.providerId ? "Opens a new conversation; keeps the current one." : "Keeps this conversation and its context."}
                </span>
                <button
                    type="button"
                    className="controller-runtime-apply"
                    disabled={loading || applying || testing || !options || unavailable || missingModel || missingEffort || waiting}
                    onClick={() => {

                        void save();
                    }}
                >
                    {applying ? "Connecting…" : "Apply"}
                </button>
            </footer>
        </section>}
    </div>;
}
