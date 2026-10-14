import { agentTierLabels } from "../../../shared/agent/sessions";
import { useAgentPanel } from "../workbench/WorkbenchChrome";
import { AgentDock } from "./AgentDock";
import { sessionAgentService } from "./session-agent-service";
import { useMemo } from "react";

export const ManagedAgentDock = () => {

    const { activeSession } = useAgentPanel();
    const activeSessionId = activeSession?.id;
    const service = useMemo(() => {

        return activeSessionId ? sessionAgentService(window.avesd.agentSessions, activeSessionId) : undefined;
    }, [activeSessionId]);

    return service && activeSession ? <AgentDock
        key={activeSession.id}
        service={service}
        managed
        label={agentTierLabels[activeSession.tier]}
    /> : null;
};
