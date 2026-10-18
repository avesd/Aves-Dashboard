/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Voice
 * @description VoiceControls
 */

import { useControllerApi } from "../controller-context";
import type { VoiceState } from "./live-connection";
import { LiveConnection } from "./live-connection";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import { Button } from "@avesd/ui-controls";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function VoiceControls({ agentId, disabled = false }: {
    readonly agentId?: string;
    readonly disabled?: boolean;
}) {

    const api = useControllerApi();
    const [
        configured,
        setConfigured,
    ] = useState<boolean>();
    const [
        state,
        setState,
    ] = useState<VoiceState>();
    const [
        error,
        setError,
    ] = useState<string>();
    const connection = useRef<LiveConnection>(null);
    const starting = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {

        mounted.current = true;
        let generation = 0;
        const refresh = () => {

            const current = ++generation;
            void api.voice.availability().then(value => {

                if (mounted.current && current === generation) {
                    setConfigured(value.configured);
                }
            })
                .catch(cause => {

                    if (mounted.current && current === generation) {
                        setError(ipcErrorMessage(cause, "Voice configuration unavailable."));
                    }
                });
        };
        refresh();
        const unsubscribe = api.settings.subscribe(refresh);

        return () => {

            unsubscribe();
            mounted.current = false;
            connection.current?.dispose();
        };
    }, [
        api.voice,
        api.settings,
    ]);
    useEffect(() => {

        if (connection.current && connection.current.agentId !== agentId) {
            connection.current.end();
        }
    }, [agentId]);
    const active = !!state && [
        "connecting",
        "connected",
        "closing",
    ].includes(state.status);
    const start = async () => {

        if (starting.current) {
            return;
        }
        starting.current = true;
        setError(undefined);
        try {
            const id = agentId ?? (await api.agentSessions.create("flagship")).id;
            if (!mounted.current) {
                return;
            }
            connection.current?.dispose();
            const next = new LiveConnection(id, api.voice, value => {

                if (mounted.current) {
                    setState(value);
                }
            });
            connection.current = next;
            await next.start();
        } catch (cause) {
            if (mounted.current) {
                setError(ipcErrorMessage(cause, "Could not start voice. Check the Agent session."));
            }
        }
        finally {
            starting.current = false;
        }
    };

    return <section
        className="voice-controls"
        aria-label="Live voice"
    >
        <div
            className="voice-toolbar"
        >
            {!active ? <Button
                className="min-h-[32px] px-avesd-8 py-avesd-4 type-caption"
                variant="quiet"
                size="small"
                type="button"
                disabled={!configured || disabled}
                onClick={() => {

                    void start();
                }}
            >
                <Mic
                    size={14}
                />
                Start voice
            </Button> : <>
                <Button
                    className="min-h-[32px] px-avesd-8 py-avesd-4 type-caption"
                    variant="quiet"
                    size="small"
                    type="button"
                    aria-label={state.muted ? "Unmute microphone" : "Mute microphone"}
                    aria-pressed={state.muted}
                    disabled={state.status !== "connected"}
                    onClick={() => {

                        return connection.current?.mute();
                    }}
                >
                    {state.muted ? <MicOff
                        size={14}
                    /> : <Mic
                        size={14}
                    />}
                </Button>
                <Button
                    className="min-h-[32px] px-avesd-8 py-avesd-4 type-caption"
                    variant="quiet"
                    size="small"
                    type="button"
                    disabled={state.status !== "connected"}
                    onClick={() => {

                        return state.quiet ? connection.current?.resume() : connection.current?.interrupt();
                    }}
                >
                    {state.quiet ? <Volume2
                        size={14}
                    /> : <VolumeX
                        size={14}
                    />}
                    {state.quiet ? "Resume audio" : "Stop speaking"}
                </Button>
                <Button
                    className="min-h-[32px] px-avesd-8 py-avesd-4 type-caption"
                    variant="quiet"
                    size="small"
                    type="button"
                    disabled={state.status === "closing"}
                    onClick={() => {

                        return connection.current?.end();
                    }}
                >
                    <PhoneOff
                        size={14}
                    />
                    End voice
                </Button>
                <Button
                    className="min-h-[32px] px-avesd-8 py-avesd-4 type-caption"
                    variant="quiet"
                    size="small"
                    type="button"
                    disabled={state.status !== "connected"}
                    onClick={() => {

                        const id = connection.current?.id;
                        if (id) {
                            void api.voice.cancelTask(id).catch((cause) => {

                                return void setError(ipcErrorMessage(cause, "Could not cancel the task."));
                            });
                        }
                    }}
                >
                    Cancel task
                </Button>
            </>}
        </div>
        <p
            role="status"
        >
            {error ?? (configured === false ? "Add an OpenAI API key in Settings → Models & services to enable voice." : state?.message ?? "AI voice via OpenAI · Tools via DeepSeek.")}
        </p>
        {active && <p
            className="voice-hint"
        >
            Interrupt speech freely. Task additions wait for the current turn.
        </p>}
        {active && state.input && <p
            className="voice-caption"
        >
            <strong>You: </strong>
            {state.input}
        </p>}
        {active && state.output && <p
            className="voice-caption"
        >
            <strong>Voice: </strong>
            {state.output}
        </p>}
    </section>;
}
