import type { AcpProvider } from "./provider-contract";
import type { AcpProviderInstallations } from "./provider-installations";

export function createAcpProviders(installations: AcpProviderInstallations): readonly AcpProvider[] {

    return installations.registry.list().map(definition => {

        return {
            id: definition.id,
            name: definition.name,
            toolPermissionFormat: definition.toolPermissionFormat ?? "server-tool",
            availability: () => {

                const item = installations.list().find(provider => {

                    return provider.id === definition.id;
                })!;

                return {
                    available: item.enabled && item.status === "installed",
                    unavailableReason: !item.enabled ? "Disabled" : item.status === "not-found" ? "Not installed"
                        : item.status === "checking" ? "Checking installation" : item.status === "error" ? "Needs attention" : undefined,
                };
            },
            launch: async () => {

                return definition.launch(await installations.executable(definition.id));
            },
        };
    });
}
