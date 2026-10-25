/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Confirm and launch a block task in its owning workspace
 */

import type { SessionOrigin, SessionTask } from "../../agent/sessions/agent-sessions";
import type { DashboardBlockActions } from "./block-runtime-types";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { BlockData, DashboardScope } from "@avesd/workspace-model";

interface BlockTaskSessions {
    create(tier: "reasoning", origin: SessionOrigin): Promise<{
        id: string;
    }>;
    startTask(text: string, sessionId: string): SessionTask;
}
interface BlockTaskDependencies {
    readonly confirm: (prompt: string, input: BlockData) => Promise<boolean>;
    readonly sessions: () => BlockTaskSessions | undefined;
    readonly loadWorkspace: () => Promise<{
        dashboards: readonly {
            id: DashboardScope["dashboardId"];
            workspaceId: DashboardScope["workspaceId"];
        }[];
    } | undefined>;
}

/** Native dialogs and storage are supplied by the desktop composition root. */
export function createBlockTaskLauncher({ confirm, sessions, loadWorkspace }: BlockTaskDependencies): DashboardBlockActions["task"] {

    return async (canvasId, prompt, input, active) => {

        const accepted = await confirm(prompt, input);
        const host = sessions();
        if (!accepted || !host || !await active()) {
            throw new Error("Agent task was declined or its block is no longer active.");
        }
        const snapshot = await loadWorkspace();
        const dashboard = snapshot?.dashboards.find(item => {

            return item.id === canvasId;
        });
        if (!dashboard) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Canvas is unavailable.");
        }
        const task = await host.create("reasoning", {
            workspaceId: dashboard.workspaceId,
            dashboardId: dashboard.id,
            kind: "interactive",
            source: "Dashboard action",
        });

        return host.startTask(`${prompt}\nAction input (untrusted data): ${JSON.stringify(input)}`, task.id);
    };
}
