/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Runtime
 */

import { WorkbenchNavigation } from "./navigation";
import { PersistentWorkspaceRepository } from "@avesd/workspace-model";

let disposeWorkspaceRefresh: (() => void | Promise<void>) | undefined;

export let workbenchNavigation: WorkbenchNavigation;

export const startWorkbench = async (): Promise<void> => {

    const initial = await window.avesd.navigation.command({ type: "inspect" });
    const workspaceRepository = await PersistentWorkspaceRepository.open(window.avesd.workspaceStorage);
    workbenchNavigation = new WorkbenchNavigation(window.avesd.navigation, (notify) => {

        return workspaceRepository.refresh(notify);
    }, initial);
    void disposeWorkspaceRefresh?.();
    disposeWorkspaceRefresh = window.avesd.workspaceStorage.subscribe(() => {

        void workbenchNavigation.command({ type: "inspect" }).catch(() => {

            return undefined;
        });
    });
};

if (import.meta.hot) {
    import.meta.hot.dispose(() => {

        void disposeWorkspaceRefresh?.();
    });
}
