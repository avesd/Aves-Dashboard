import { z } from "zod";

export const liveChannels = {
    command: "live:command",
    event: "live:event",
} as const;
const identifier = z.string().min(1)
    .max(128);
export const liveEventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("session.started") }),
    z.object({ type: z.literal("session.closed") }),
    z.object({
        type: z.literal("session.input_transcript.delta"),
        delta: z.string().max(8192),
        start_ms: z.number().nonnegative(),
        end_ms: z.number().nonnegative(),
    }),
    z.object({
        type: z.literal("session.output_transcript.delta"),
        delta: z.string().max(8192),
        start_ms: z.number().nonnegative(),
        end_ms: z.number().nonnegative(),
    }),
    z.object({
        type: z.literal("session.delegation.created"),
        offset_ms: z.number().nonnegative(),
        delegation: z.object({
            id: identifier,
            target: z.literal("client"),
        }),
    }),
]);
export type LiveEvent = z.infer<typeof liveEventSchema>;
export const liveRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("availability") }),
    z.object({
        type: z.literal("start"),
        connectionId: z.uuid(),
        agentId: identifier,
        sdp: z.string().min(1)
            .max(65536),
    }),
    z.object({
        type: z.literal("event"),
        connectionId: z.uuid(),
        event: liveEventSchema,
    }),
    z.object({
        type: z.literal("stop"),
        connectionId: z.uuid(),
    }),
    z.object({
        type: z.literal("cancelTask"),
        connectionId: z.uuid(),
    }),
]);
export type LiveCommand = {
    readonly type: "session.commentary.append" | "session.thinking.append" | "session.instructions.append";
    readonly event_id: string;
    readonly delegation_id: string | null;
    readonly content: string;
};
export interface LiveVoiceApi {
    availability(): Promise<{
        configured: boolean;
    }>;
    start(connectionId: string, agentId: string, sdp: string): Promise<{
        sdp: string;
    }>;
    event(connectionId: string, event: LiveEvent): Promise<void>;
    stop(connectionId: string): Promise<void>;
    cancelTask(connectionId: string): Promise<void>;
    subscribe(listener: (event: {
        connectionId: string;
        command: LiveCommand;
    }) => void): () => void;
}
