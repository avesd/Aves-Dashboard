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

export function VoiceControls({ agentId, disabled = false, expanded }: {
    readonly agentId?: string;
    readonly expanded: boolean;
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

    let statusMessage = "Checking voice availability…";
    if (configured === true) {
        statusMessage = "Start a conversation · microphone is off.";
    } else if (configured === false) {
        statusMessage = "Set up voice in Settings, or use text input.";
    }
    if (state) {
        statusMessage = state.message;
        if (state.status === "connected" && state.muted && state.message === "Listening · GPT-Live 1") {
            statusMessage = "Microphone muted · still connected";
        }
    }
    if (error) {
        statusMessage = error;
    }

    return <section
        className="voice-controls"
        aria-label="Live voice"
        data-active={active}
    >
        <div
            className="voice-toolbar"
        >
            {!active ? <Button
                className="voice-toolbar-button voice-start w-full min-h-[40px]"
                variant="primary"
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
                    className="voice-toolbar-button min-h-[32px] px-gridui-8 py-gridui-4 type-caption"
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
                    <span
                        className="voice-mic-label"
                    >
                        {state.muted ? "Mic off" : "Mic on"}
                    </span>
                </Button>
                <Button
                    className="voice-toolbar-button min-h-[32px] px-gridui-8 py-gridui-4 type-caption"
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
                    className="voice-toolbar-button min-h-[32px] px-gridui-8 py-gridui-4 type-caption"
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
            </>}
        </div>
        <p
            className="voice-text voice-status"
            role="status"
        >
            {statusMessage}
        </p>
        {expanded && active && <p
            className="voice-text voice-hint"
        >
            Interrupt speech freely. Task additions wait for the current turn.
        </p>}
        {expanded && active && state.input && <p
            className="voice-text voice-caption"
        >
            <strong>You: </strong>
            {state.input}
        </p>}
        {expanded && active && state.output && <p
            className="voice-text voice-caption"
        >
            <strong>Voice: </strong>
            {state.output}
        </p>}
    </section>;
}
