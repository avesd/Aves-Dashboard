import type { AcpProviderDefinition, AcpProviderId, AcpSelection } from "./provider-contract";

export function parseAcpProviderId(input: unknown): AcpProviderId {

    if (typeof input !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(input)) {
        throw new Error("Invalid ACP provider ID.");
    }

    return input;
}
export function parseAcpSelection(input: unknown): AcpSelection {

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Invalid ACP selection.");
    }
    const value = input as Record<string, unknown>;
    if (typeof value.modelId !== "string" || value.modelId.length > 512
        || typeof value.effortId !== "string" || value.effortId.length > 512) {
        throw new Error("Invalid ACP selection.");
    }

    return {
        providerId: parseAcpProviderId(value.providerId),
        modelId: value.modelId.trim(),
        effortId: value.effortId.trim(),
    };
}

/** Registration owns provider identity; applications supply launch strategies at composition time. */
export class AcpProviderRegistry {
    readonly #definitions = new Map<AcpProviderId, AcpProviderDefinition>();

    constructor(definitions: readonly AcpProviderDefinition[] = []) {

        for (const definition of definitions) {
            this.register(definition);
        }
    }
    register(definition: AcpProviderDefinition): this {

        const id = parseAcpProviderId(definition.id);
        if (this.#definitions.has(id) || !definition.name.trim() || !definition.command.trim()
            || typeof definition.launch !== "function") {
            throw new Error("Invalid or duplicate ACP registration.");
        }
        if (definition.setupUrl && new URL(definition.setupUrl).protocol !== "https:") {
            throw new Error("ACP setup guides must use HTTPS.");
        }
        this.#definitions.set(id, Object.freeze({ ...definition }));

        return this;
    }
    get(input: unknown): AcpProviderDefinition {

        const definition = this.#definitions.get(parseAcpProviderId(input));
        if (!definition) {
            throw new Error("This ACP is not registered.");
        }

        return definition;
    }
    list(): readonly AcpProviderDefinition[] {

        return [...this.#definitions.values()];
    }
}
