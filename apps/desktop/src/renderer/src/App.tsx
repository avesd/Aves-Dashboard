/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description App
 */

import { CanvasShell } from "./components/CanvasShell";
import { ManagedAgentDock } from "./components/ManagedAgentDock";
import { workbenchNavigation } from "./workbench/runtime";
import { WorkbenchChrome } from "./workbench/WorkbenchChrome";
import { useSyncExternalStore } from "react";

export const App = () => {

    const navigationState = useSyncExternalStore(workbenchNavigation.subscribe, workbenchNavigation.getSnapshot);
    const { scope } = navigationState;

    return <WorkbenchChrome
        browserTasks={window.avesd.browserTasks}
        preferences={window.avesd.preferences}
        agentProviders={window.avesd.agentProviders}
        agentSessions={window.avesd.agentSessions}
        workspaceStorage={window.avesd.workspaceStorage}
        workspaceNavigation={{
            state: navigationState,
            select: scope => {

                return workbenchNavigation.command({
                    type: "select",
                    scope,
                });
            },
        }}
    >
        <CanvasShell
            key={`${scope.workspaceId}/${scope.dashboardId}`}
            api={window.avesd.canvas}
            agent={window.avesd.agentSessions}
            scope={scope}
        />
        <ManagedAgentDock
            key={`${scope.workspaceId}/${scope.dashboardId}`}
        />
    </WorkbenchChrome>;
};
