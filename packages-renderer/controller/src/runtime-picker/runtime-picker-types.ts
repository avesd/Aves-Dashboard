/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace RuntimePicker
 * @description Runtime Picker Types
 */

import type { ControllerApi } from "../controller-api";
import type { AgentSessionSnapshot, AgentTierRoute } from "@avesd/desktop-contracts/agent/sessions";

export interface RuntimePickerProps {
    readonly api: ControllerApi["agentSessions"];
    readonly providersApi: Pick<ControllerApi["agentProviders"], "availability">;
    readonly settings: Pick<ControllerApi["settings"], "subscribe">;
    readonly session: AgentSessionSnapshot | null;
    readonly disabled: boolean;
    readonly applying: boolean;
    readonly apply: (route: AgentTierRoute) => Promise<void>;
    readonly newConversation: () => void;
    readonly manage: () => void;
}
