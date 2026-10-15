export type AcpProviderId = string;
export type AcpToolPermissionFormat = "server-tool" | "qualified-name";
export interface AcpLaunch {
    readonly command: string;
    readonly args: string[];
    readonly env?: Record<string, string>;
}
export interface AcpProviderDefinition {
    readonly id: AcpProviderId;
    readonly name: string;
    readonly command: string;
    readonly loginCommand: string;
    readonly setupUrl?: string;
    readonly defaultExecutablePath?: string;
    readonly toolPermissionFormat?: AcpToolPermissionFormat;
    readonly launch: (executable: string) => AcpLaunch | Promise<AcpLaunch>;
}
export interface AcpProviderConfiguration {
    readonly enabled: boolean;
    readonly executablePath: string;
}
export interface AcpProviderInstallation extends AcpProviderConfiguration {
    readonly id: AcpProviderId;
    readonly name: string;
    readonly status: "checking" | "installed" | "not-found" | "error";
    readonly source: "bundled" | "system" | "custom";
    readonly bundledAvailable: boolean;
    readonly resolvedPath?: string;
    readonly version?: string;
    readonly message?: string;
    readonly loginCommand: string;
    readonly setupUrl?: string;
}
export interface AcpProvider {
    readonly id: AcpProviderId;
    readonly name: string;
    readonly toolPermissionFormat: AcpToolPermissionFormat;
    readonly availability: () => {
        available: boolean;
        unavailableReason?: string;
    };
    readonly launch: () => AcpLaunch | Promise<AcpLaunch>;
}
export interface AcpSelection {
    readonly providerId: AcpProviderId;
    readonly modelId: string;
    readonly effortId: string;
}
export interface AcpModelOptions {
    readonly models: readonly {
        readonly id: string;
        readonly name: string;
    }[];
    readonly efforts: readonly {
        readonly id: string;
        readonly name: string;
    }[];
    readonly defaultModelId?: string;
    readonly defaultEffortId?: string;
    readonly modelId?: string;
    readonly effortId?: string;
}
export type AcpModelProbeResult = {
    readonly ok: true;
    readonly options: AcpModelOptions;
    readonly tested: boolean;
}
    | {
        readonly ok: false;
        readonly message: string;
    };
