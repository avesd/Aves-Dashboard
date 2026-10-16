import type { LiveVoiceApi } from "../../../shared/voice/live";
import { liveEventSchema } from "../../../shared/voice/live";

export interface VoiceState {
    status: "connecting" | "connected" | "closing" | "ended" | "error";
    message: string;
    input: string;
    output: string;
    muted: boolean;
    quiet: boolean;
}

/** Owns browser media only. Credentials and Agent execution remain in the main process. */
export class LiveConnection {
    readonly id = crypto.randomUUID();
    readonly #peer = new RTCPeerConnection();
    readonly #audio = new Audio();
    #microphone?: MediaStream;
    #channel?: RTCDataChannel;
    #closed = false;
    #ready = false;
    #unsubscribe?: () => void;
    #timeout?: ReturnType<typeof setTimeout>;
    #delivery = Promise.resolve();
    #state: VoiceState = {
        status: "connecting",
        message: "Connecting to GPT-Live…",
        input: "",
        output: "",
        muted: false,
        quiet: false,
    };
    constructor(readonly agentId: string, private readonly api: LiveVoiceApi, private readonly changed: (state: VoiceState) => void) {}
    #update(patch: Partial<VoiceState>): void {

        this.#state = {
            ...this.#state,
            ...patch,
        }; this.changed(this.#state);
    }
    private isClosed(): boolean {

        return this.#closed;
    }
    async start(): Promise<void> {

        this.#update({});
        this.#timeout = setTimeout(() => {

            return void this.#fail("Voice connection timed out.");
        }, 35000);
        try {
            this.#audio.autoplay = true;
            this.#peer.ontrack = event => {

                if (this.isClosed()) {
                    return;
                }

                this.#audio.srcObject = new MediaStream([event.track]);
                void this.#audio.play().catch(() => {

                    return void this.#update({
                        message: "Select Resume audio to hear the assistant.",
                        quiet: true,
                    });
                });
            };
            this.#peer.onconnectionstatechange = () => {

                if ([
                    "failed",
                    "disconnected",
                ].includes(this.#peer.connectionState)) {
                    this.#fail("Voice connection lost. Agent work can still continue.");
                }
            };
            const microphone = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            if (this.isClosed()) {
                microphone.getTracks().forEach(track => {

                    return void track.stop();
                });

                return;
            }
            this.#microphone = microphone;
            for (const track of microphone.getAudioTracks()) {
                this.#peer.addTrack(track, microphone);
                track.onended = () => {

                    return void this.#fail("Microphone disconnected.");
                };
            }
            const channel = this.#peer.createDataChannel("oai-events");
            this.#channel = channel;
            this.#unsubscribe = this.api.subscribe(event => {

                if (event.connectionId === this.id && this.#ready && !this.#closed && channel.readyState === "open") {
                    channel.send(JSON.stringify(event.command));
                }
            });
            channel.onmessage = message => {

                if (this.#closed || typeof message.data !== "string" || message.data.length > 65536) {
                    return;
                }
                try {
                    const raw: unknown = JSON.parse(message.data);
                    if (raw && typeof raw === "object" && "type" in raw && raw.type === "error") {
                        this.#fail("GPT-Live reported an error. End voice and try again.");

                        return;
                    }
                    const parsed = liveEventSchema.safeParse(raw);
                    if (!parsed.success) {
                        return;
                    }
                    const event = parsed.data;
                    if (event.type === "session.started") {
                        this.#ready = true; clearTimeout(this.#timeout);
                        this.#update({
                            status: "connected",
                            message: "Listening · GPT-Live 1",
                        });
                    }
                    if (event.type === "session.input_transcript.delta") {
                        this.#update({ input: (this.#state.input + event.delta).slice(-240) });
                    }
                    if (event.type === "session.output_transcript.delta") {
                        this.#update({ output: (this.#state.output + event.delta).slice(-240) });
                    }
                    this.#delivery = this.#delivery.then(() => {

                        return this.api.event(this.id, event);
                    }).catch(() => {

                        return void this.#fail("Voice task connection failed.");
                    });
                    if (event.type === "session.closed") {
                        this.#update({
                            status: "ended",
                            message: "Voice ended. Agent work is unchanged.",
                        }); this.dispose();
                    }
                } catch { this.#fail("Invalid voice session event."); }
            };
            channel.onclose = () => {

                if (!this.#closed) {
                    this.#fail("Voice disconnected before finalization. Agent work is unchanged.");
                }
            };
            channel.onerror = () => {

                return void this.#fail("Voice data connection failed.");
            };
            await this.#peer.setLocalDescription(await this.#peer.createOffer());
            if (this.isClosed()) {
                return;
            }
            if (this.#peer.iceGatheringState !== "complete") {
                await new Promise<void>((resolve, reject) => {

                    const timeout = setTimeout(() => {

                        this.#peer.removeEventListener("icegatheringstatechange", check); reject(new Error("ICE timeout"));
                    }, 10000);
                    const check = () => {

                        if (this.#peer.iceGatheringState === "complete" || this.#closed) {
                            clearTimeout(timeout); this.#peer.removeEventListener("icegatheringstatechange", check); resolve();
                        }
                    };
                    this.#peer.addEventListener("icegatheringstatechange", check); check();
                });
            }
            if (this.isClosed()) {
                return;
            }
            const sdp = this.#peer.localDescription?.sdp;
            if (!sdp) {
                throw new Error("Missing SDP");
            }
            const answer = await this.api.start(this.id, this.agentId, sdp);
            if (this.isClosed()) {
                await this.api.stop(this.id);

                return;
            }
            await this.#peer.setRemoteDescription({
                type: "answer",
                sdp: answer.sdp,
            });
        } catch (error) {
            if (!this.#closed) {
                this.#fail(error instanceof Error && error.name === "NotAllowedError" ? "Microphone access denied. Allow microphone access in system settings." : "Could not connect. Check microphone, network, and GPT-Live API access.");
            }
        }
    }
    mute(): void {

        const muted = !this.#state.muted;
        this.#microphone?.getAudioTracks().forEach(track => {

            track.enabled = !muted;
        });
        this.#update({ muted });
    }
    interrupt(): void {

        this.#audio.muted = true;
        this.#update({ quiet: true });
        if (this.#ready && this.#channel?.readyState === "open") {
            this.#channel.send(JSON.stringify({
                type: "session.instructions.append",
                event_id: crypto.randomUUID(),
                delegation_id: null,
                content: "Stop speaking now and listen. Do not cancel or alter any backend task. Resume speaking when the user next asks a question.",
            }));
        }
    }
    resume(): void {

        this.#audio.muted = false;
        void this.#audio.play().then(() => {

            return void this.#update({ quiet: false });
        })
            .catch(() => {

                return void this.#update({ message: "Audio playback is blocked. Check the output device." });
            });
    }
    end(): void {

        if (this.isClosed()) {
            return;
        }
        void this.api.stop(this.id).catch(() => {
        });
        this.#microphone?.getAudioTracks().forEach(track => {

            track.enabled = false;
        });
        this.#audio.muted = true;
        if (this.#ready && this.#channel?.readyState === "open") {
            this.#ready = false;
            this.#update({
                status: "closing",
                message: "Ending voice…",
            });
            this.#channel.send(JSON.stringify({ type: "session.close" }));
            this.#timeout = setTimeout(() => {

                return void this.#fail("Voice closed without final usage confirmation.");
            }, 5000);
        } else {
            this.#update({
                status: "ended",
                message: "Voice ended.",
            }); this.dispose();
        }
    }
    #fail(message: string): void {

        if (this.isClosed()) {
            return;
        }
        this.#update({
            status: "error",
            message,
        }); this.dispose();
    }
    dispose(): void {

        if (this.isClosed()) {
            return;
        }
        if (this.#ready && this.#channel?.readyState === "open") {
            this.#channel.send(JSON.stringify({ type: "session.close" }));
        }
        this.#closed = true; this.#ready = false;
        clearTimeout(this.#timeout); this.#unsubscribe?.();
        this.#microphone?.getTracks().forEach(track => {

            track.onended = null; track.stop();
        });
        this.#audio.pause(); this.#audio.srcObject = null;
        this.#channel?.close(); this.#peer.close();
        void this.api.stop(this.id).catch(() => {
        });
    }
}
