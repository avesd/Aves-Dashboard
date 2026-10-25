/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Root
 * @description Controller API
 */

import type { AgentSessionsApi } from "@avesd/desktop-contracts/agent/sessions";
import type { CanvasServiceApi } from "@avesd/desktop-contracts/canvas/contracts";
import type { DesktopViewsApi } from "@avesd/desktop-contracts/canvas/views";
import type { AgentProvidersApi } from "@avesd/desktop-contracts/settings";
import type { LiveVoiceApi } from "@avesd/desktop-contracts/voice/live";

export interface ControllerApi {
    readonly agentSessions: Pick<AgentSessionsApi, "list" | "create" | "select" | "read" | "connect" | "configureSession" | "prompt" | "enqueue" | "cancelTurn" | "remove" | "routes" | "configureFlagship" | "probeRoute" | "subscribe">;
    readonly agentProviders: Pick<AgentProvidersApi, "availability" | "list">;
    readonly canvases: Pick<CanvasServiceApi, "list" | "subscribe">;
    readonly views: Pick<DesktopViewsApi, "inspect" | "subscribe" | "controller" | "open">;
    readonly voice: LiveVoiceApi;
    readonly settings: {
        open(): Promise<void>;
        subscribe(listener: () => void): () => void;
    };
}
