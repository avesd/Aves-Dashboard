/**
 * @author Avesd
 * @package ACP Management
 * @namespace Root
 * @description Provider Installations
 */

import type { AcpProviderConfiguration, AcpProviderId, AcpProviderInstallation } from "./provider-contract";
import { probeCli } from "./provider-detection";
import type { AcpProviderRegistry } from "./provider-registry";
import { parseAcpProviderId } from "./provider-registry";
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

function parseConfiguration(input: unknown): AcpProviderConfiguration {

    if (!input || typeof input !== "object") {
        throw new Error("Invalid provider configuration.");
    }
    const value = input as Record<string, unknown>;
    if (typeof value.enabled !== "boolean" || typeof value.executablePath !== "string") {
        throw new Error("Invalid provider configuration.");
    }
    const executablePath = value.executablePath.trim();
    if (executablePath.length > 4096 || /[\0\r\n]/.test(executablePath) || (executablePath && !isAbsolute(executablePath))) {
        throw new Error("Use an absolute executable path, or leave it empty for automatic detection.");
    }

    return {
        enabled: value.enabled,
        executablePath,
    };
}

export class AcpProviderInstallations {
    private configurations = new Map<AcpProviderId, AcpProviderConfiguration>();
    private probes = new Map<AcpProviderId, Awaited<ReturnType<typeof probeCli>>>();
    private running?: Promise<void>;
    private saving: Promise<void> = Promise.resolve();
    constructor(private readonly path: string, readonly registry: AcpProviderRegistry, private readonly probe = probeCli) {}

    static async open(path: string, registry: AcpProviderRegistry): Promise<AcpProviderInstallations> {

        const manager = new AcpProviderInstallations(path, registry);
        try {
            const data = JSON.parse(await readFile(path, "utf8")) as unknown;
            if (!data || typeof data !== "object" || Array.isArray(data)) {
                throw new Error("Invalid agent installation settings.");
            }
            for (const [
                id,
                value,
            ] of Object.entries(data)) {manager.configurations.set(parseAcpProviderId(id), parseConfiguration(value));}
        } catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                throw error;
            }
        }

        return manager;
    }

    list(): readonly AcpProviderInstallation[] {

        return this.registry.list().map(({ id, name, loginCommand, setupUrl, defaultExecutablePath }) => {

            return {
                id,
                name,
                loginCommand,
                ...(setupUrl ? { setupUrl } : {}),
                bundledAvailable: !!defaultExecutablePath,
                source: this.configurations.get(id)?.executablePath ? "custom" : defaultExecutablePath ? "bundled" : "system",
                ...(this.configurations.get(id) ?? {
                    enabled: true,
                    executablePath: "",
                }),
                ...(this.probes.get(id) ?? { status: "checking" as const }),
            };
        });
    }
    refresh(): Promise<void> {

        if (this.running) {
            return this.running;
        }
        const configurations = new Map(this.configurations);
        const running = Promise.all(this.registry.list().map(async definition => {

            const result = await this.probe(definition.command, configurations.get(definition.id)?.executablePath || definition.defaultExecutablePath || "");
            if (configurations.get(definition.id) === this.configurations.get(definition.id)) {
                this.probes.set(definition.id, result);
            }
        })).then(() => {
        })
            .finally(() => {

                if (this.running === running) {
                    this.running = undefined;
                }
            });
        this.running = running;

        return running;
    }
    configure(id: unknown, input: unknown): Promise<void> {

        const providerId = this.registry.get(id).id;
        const configuration = parseConfiguration(input);
        const save = this.saving.catch(() => {
        }).then(async () => {

            const next = new Map(this.configurations); next.set(providerId, configuration);
            const temporary = `${this.path}.${randomUUID()}.tmp`;
            try {
                await writeFile(temporary, JSON.stringify(Object.fromEntries(next)), { mode: 0o600 });
                await rename(temporary, this.path);
                this.configurations = next;
                this.probes.delete(providerId);
            } finally {
                await unlink(temporary).catch(() => {
                });
            }
            await this.running;
            await this.refresh();
        });
        this.saving = save;

        return save;
    }
    async executable(id: AcpProviderId): Promise<string> {

        this.registry.get(id);
        await this.refresh();
        const provider = this.list().find(item => {

            return item.id === id;
        })!;
        if (!provider.enabled) {
            throw new Error(`${provider.name} is disabled. Enable it in Settings → Agents.`);
        }
        if (provider.status !== "installed" || !provider.resolvedPath) {
            throw new Error(`${provider.name} is unavailable. Check Settings → Agents.`);
        }

        return provider.resolvedPath;
    }
}
