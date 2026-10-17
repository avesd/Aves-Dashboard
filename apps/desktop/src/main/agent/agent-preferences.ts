/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent Preferences
 */

import type { AgentTierRoutes } from "../../shared/agent/sessions";
import { parseAgentRoute, parseAgentRoutes } from "../../shared/agent/sessions";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

const parseProviderId = (id: unknown): void => {

    if (typeof id !== "string" || !id || id.length > 128) {
        throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid provider.");
    }
};

/** Stores IDs only, outside workspace content. Credentials are loaded separately in the main process. */
export class AgentPreferences {
    routes: AgentTierRoutes = {
        flagship: {
            providerId: "deepseek",
            modelId: "",
            effortId: "",
        },
        reasoning: {
            providerId: "deepseek",
            modelId: "",
            effortId: "",
        },
        action: {
            providerId: "deepseek",
            modelId: "",
            effortId: "",
        },
    };
    #revision = 0;
    readonly #listeners = new Set<() => void>();
    get revision(): number {

        return this.#revision;
    }
    subscribe(listener: () => void): () => void {

        this.#listeners.add(listener);

        return () => {

            this.#listeners.delete(listener);
        };
    }
    private saving: Promise<void> = Promise.resolve();
    providerId = "deepseek";
    models: Record<string, string> = {};
    constructor(private readonly path?: string) {}
    static async open(path: string): Promise<AgentPreferences> {

        const preferences = new AgentPreferences(path);
        try {
            const data = JSON.parse(await readFile(path, "utf8")) as unknown;
            if (!data || typeof data !== "object") {
                throw new Error();
            }
            const value = data as Record<string, unknown>;
            parseProviderId(value.providerId);
            if (!value.models || typeof value.models !== "object" || Array.isArray(value.models)
                || Object.entries(value.models).some(([
                    key,
                    model,
                ]) => {

                    parseProviderId(key);

                    return typeof model !== "string" || model.length > 512;
                })) {
                throw new Error();
            }
            if (value.routes !== undefined) {
                preferences.routes = parseAgentRoutes(value.routes);
            }
            preferences.providerId = value.providerId as string;
            preferences.models = value.models as Record<string, string>;
            // Migrate previous external-Agent selections without starting their adapters.
            preferences.providerId = "deepseek";
            for (const tier of [
                "flagship",
                "reasoning",
                "action",
            ] as const) {
                if (preferences.routes[tier].providerId !== "deepseek") {
                    preferences.routes = {
                        ...preferences.routes,
                        [tier]: {
                            providerId: "deepseek",
                            modelId: "",
                            effortId: "",
                        },
                    };
                }
            }
        } catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                throw new Error("Agent preferences could not be loaded.", { cause: error });
            }
        }

        return preferences;
    }
    save(providerId: string, models = this.models): Promise<void> {

        return this.#save(() => {

            return {
                providerId,
                models,
                routes: this.routes,
            };
        });
    }
    configureFlagship(input: unknown): Promise<void> {

        const route = parseAgentRoute(input);

        return this.#save(() => {

            return {
                providerId: this.providerId,
                models: this.models,
                routes: {
                    ...this.routes,
                    flagship: route,
                },
            };
        });
    }
    configureRoutes(input: unknown, expectedRevision?: number): Promise<void> {

        const routes = parseAgentRoutes(input);

        return this.#save(() => {

            return {
                providerId: this.providerId,
                models: this.models,
                routes,
            };
        }, expectedRevision);
    }
    #save(next: () => {
        providerId: string;
        models: Record<string, string>;
        routes: AgentTierRoutes;
    }, expectedRevision?: number): Promise<void> {

        const save = this.saving.catch(() => {
        }).then(async () => {

            if (expectedRevision !== undefined && expectedRevision !== this.#revision) {
                throw new OperationError(IpcErrorCode.VersionConflict, "Settings changed in another window. Reload before saving.", this.#revision);
            }
            const value = next();
            if (this.path) {
                const temporary = `${this.path}.${randomUUID()}.tmp`;
                try {
                    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
                    await rename(temporary, this.path);
                } finally {
                    await unlink(temporary).catch(() => {
                    });
                }
            }
            this.providerId = value.providerId;
            this.models = { ...value.models };
            this.routes = value.routes;
            this.#revision++;
            for (const listener of this.#listeners) {
                listener();
            }
        });
        this.saving = save;

        return save;
    }
}
