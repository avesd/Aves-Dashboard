import * as z from "zod";

export const viewRequestSchema = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("inspect") }),
    z.strictObject({ type: z.literal("list") }),
    z.strictObject({
        type: z.literal("open"),
        canvasId: z.string().min(1)
            .max(160),
    }),
    z.strictObject({
        type: z.literal("focus"),
        viewId: z.number().int()
            .positive(),
    }),
    z.strictObject({
        type: z.literal("close"),
        viewId: z.number().int()
            .positive(),
    }),
    z.strictObject({
        type: z.literal("controller"),
        expanded: z.boolean(),
    }),
]);
export interface DesktopView {
    readonly viewId: number;
    readonly canvasId?: string;
    readonly expanded?: boolean;
}
export interface DesktopViewsApi {
    inspect(): Promise<DesktopView>;
    list(): Promise<readonly DesktopView[]>;
    open(canvasId: string): Promise<DesktopView>;
    focus(viewId: number): Promise<void>;
    close(viewId: number): Promise<void>;
    controller(expanded: boolean): Promise<void>;
    subscribe(listener: () => void): () => void;
}
export const desktopViewChannels = {
    request: "desktop-views:request",
    changed: "desktop-views:changed",
} as const;
