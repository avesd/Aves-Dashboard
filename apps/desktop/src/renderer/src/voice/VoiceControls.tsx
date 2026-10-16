import type { VoiceState } from "./live-connection";
import { LiveConnection } from "./live-connection";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function VoiceControls({ agentId, disabled = false }: {
    readonly agentId?: string;
    readonly disabled?: boolean;
}) {

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
        void window.avesd.voice.availability().then(value => {

            if (mounted.current) {
                setConfigured(value.configured);
            }
        })
            .catch(() => {

                if (mounted.current) {
                    setError("Voice configuration unavailable.");
                }
            });

        return () => {

            mounted.current = false; connection.current?.dispose();
        };
    }, []);
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
        starting.current = true; setError(undefined);
        try {
            const id = agentId ?? (await window.avesd.agentSessions.create("flagship")).id;
            if (!mounted.current) {
                return;
            }
            connection.current?.dispose();
            const next = new LiveConnection(id, window.avesd.voice, value => {

                if (mounted.current) {
                    setState(value);
                }
            });
            connection.current = next;
            await next.start();
        } catch {
            if (mounted.current) {
                setError("Could not start voice. Check the Agent session.");
            }
        }
        finally { starting.current = false; }
    };

    return <section
        className="voice-controls"
        aria-label="Live voice"
    >
        <div
            className="voice-toolbar"
        >
            {!active ? <button
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
            </button> : <>
                <button
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
                </button>
                <button
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
                </button>
                <button
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
                </button>
                <button
                    type="button"
                    disabled={state.status !== "connected"}
                    onClick={() => {

                        const id = connection.current?.id; if (id) {
                            void window.avesd.voice.cancelTask(id).catch(() => {

                                return void setError("Could not cancel the task.");
                            });
                        }
                    }}
                >
                    Cancel task
                </button>
            </>}
        </div>
        <p
            role="status"
        >
            {error ?? (configured === false ? "Set OPENAI_API_KEY before launching Avesd to enable voice." : state?.message ?? "AI voice via OpenAI · Tools via DeepSeek.")}
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
