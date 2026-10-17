/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Runtime Types
 */

import type { AnswerContinuationStatus } from "../../agent/sessions/agent-sessions";
import type { AgentTaskStatus } from "@avesd/plugin-api";
import type { BlockData, BlockQuestionOwner } from "@avesd/workspace-model";
import type { Rectangle, WebContents } from "electron";

export interface BlockLease {
    readonly id: string;
    readonly owner: WebContents;
    readonly canvasId: string;
    readonly blockId: string;
    readonly revision: number;
    readonly generation: string;
    fingerprint?: string;
    dynamic: boolean;
    status: "loading" | "ready" | "error";
    rect?: Rectangle;
    errors: string[];
}
export interface DashboardBlockActions {
    questionOwner(clientId: string): BlockQuestionOwner | undefined;
    questionActive(owner: BlockQuestionOwner, pending: boolean): boolean;
    waitForAnswer(owner: BlockQuestionOwner, key: string, waiting: boolean): void;
    respond(owner: BlockQuestionOwner, id: string, text: string, active: () => Promise<boolean>): AnswerContinuationStatus;
    responseStatus(owner: BlockQuestionOwner, id: string): AnswerContinuationStatus;
    open(canvasId: string): Promise<{
        viewId: number;
        canvasId?: string;
    }>;
    task(canvasId: string, prompt: string, input: BlockData, active: () => Promise<boolean>): Promise<{
        id: string;
    }>;
    taskResult(id: string): {
        status: AgentTaskStatus;
        answer: string;
    } | undefined;
}
