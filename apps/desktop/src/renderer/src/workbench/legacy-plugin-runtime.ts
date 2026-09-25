/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Legacy Plugin Compatibility Runtime
 */

import { createCollectionsPlugin } from "../plugins/collections/collections-plugin";
import { counterPlugin } from "../plugins/counter/counter-plugin";
import { createLocalPlugin } from "../plugins/local/local-plugin";
import { createWebPlugin } from "../plugins/web/web-plugin";
import { welcomePlugin } from "../plugins/welcome/welcome-plugin";
import { WebResults } from "./web-results";
import { CapabilityBroker, ContributionBroker, ContributionRegistry, PluginHost } from "@avesd/kernel";
import type { DataSourceContribution } from "@avesd/plugin-data";
import { dataSourceContribution } from "@avesd/plugin-data";
import type { WidgetContribution } from "@avesd/plugin-ui";
import { dashboardWidgetContribution } from "@avesd/plugin-ui";
import type { WidgetDefinition } from "@avesd/workspace-model";
import { PersistentWorkspaceRepository } from "@avesd/workspace-model";

const dashboardWidgetRegistry = new ContributionRegistry<WidgetContribution>();
const dataSourceRegistry = new ContributionRegistry<DataSourceContribution>();
const contributions = new ContributionBroker();
contributions.register(dashboardWidgetContribution, dashboardWidgetRegistry);
contributions.register(dataSourceContribution, dataSourceRegistry);
const pluginHost = new PluginHost({
    capabilities: new CapabilityBroker(() => {

        return false;
    }),
    contributions,
});
let disposeLocalPlugins: (() => void) | undefined;

const resolveWidget = (
    pluginId: string,
    widgetTypeId: string,
): WidgetDefinition | undefined => {

    const contribution = dashboardWidgetRegistry
        .getAll(dashboardWidgetContribution.id)
        .find(({ pluginId: ownerId, value }) => {

            return ownerId === pluginId && value.widgetTypeId === widgetTypeId;
        });

    return contribution?.pluginId
        ? {
            capabilities: contribution.value.capabilities,
            configurationVersion: contribution.value.configuration.version,
            defaultConfiguration: contribution.value.configuration.default,
            defaultSize: contribution.value.sizing.default,
            displayName: contribution.value.displayName,
            inputs: contribution.value.inputs ?? [],
            pluginId: contribution.pluginId,
            widgetTypeId: contribution.value.widgetTypeId,
        }
        : undefined;
};

export const startLegacyPluginRuntime = async (): Promise<void> => {

    const workspaceRepository = await PersistentWorkspaceRepository.open(window.avesd.workspaceStorage);
    const webResults = new WebResults(window.avesd.web, workspaceRepository);
    await pluginHost.replace(counterPlugin);
    await pluginHost.replace(createCollectionsPlugin(window.avesd.browserTasks));
    await pluginHost.replace(welcomePlugin);
    await pluginHost.replace(createWebPlugin(window.avesd.web, webResults));
    const revisions = new Map<string, string>();
    let syncing = Promise.resolve();
    const syncLocalPlugins = () => {

        syncing = syncing.catch(() => {

            return undefined;
        }).then(async () => {

            const plugins = await window.avesd.localPlugins.list();
            for (const plugin of plugins) {
                if (revisions.get(plugin.manifest.id) === plugin.revision) {
                    continue;
                }
                await pluginHost.replace(createLocalPlugin(plugin, window.avesd.localPlugins));
                revisions.set(plugin.manifest.id, plugin.revision);
            }
            for (const id of revisions.keys()) {
                if (!plugins.some((plugin) => {

                    return plugin.manifest.id === id;
                })) {
                    await pluginHost.remove(id); revisions.delete(id);
                }
            }
        });

        return syncing;
    };
    disposeLocalPlugins?.();
    disposeLocalPlugins = window.avesd.localPlugins.subscribe(() => {

        void syncLocalPlugins();
    });
    await syncLocalPlugins();
    await window.avesd.agent.configureWorkbench({
        dataSourceDefinitions: dataSourceRegistry.getAll(dataSourceContribution.id).flatMap(({ pluginId, value }) => {

            return pluginId ? [
                {
                    configuration: value.configuration.default,
                    dataType: value.dataType,
                    displayName: value.displayName,
                    initialValue: value.initialValue,
                    pluginId,
                    sourceTypeId: value.sourceTypeId,
                },
            ] : [];
        }),
        widgetDefinitions: dashboardWidgetRegistry.getAll(dashboardWidgetContribution.id).flatMap(({ pluginId, value }) => {

            const definition = pluginId ? resolveWidget(pluginId, value.widgetTypeId) : undefined;

            return definition ? [definition] : [];
        }),
    });
};

if (import.meta.hot) {
    import.meta.hot.accept("../plugins/welcome/welcome-plugin", (module) => {

        if (module) {
            void pluginHost.replace(module.welcomePlugin);
        }
    });

    import.meta.hot.dispose(() => {

        disposeLocalPlugins?.();
        void pluginHost.dispose();
    });
}
