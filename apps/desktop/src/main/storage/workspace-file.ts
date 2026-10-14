/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Workspace File
 */

import type { JsonObject, WorkspaceSnapshot } from "@avesd/workspace-model";
import { parseWorkspaceSnapshot } from "@avesd/workspace-model";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class WorkspaceFile {
    readonly #path: string;
    #saving = Promise.resolve();

    constructor(path: string) {

        this.#path = path;
    }

    async readService(): Promise<{
        snapshot: WorkspaceSnapshot | undefined;
        metadata: JsonObject;
    }> {

        try {
            const input = JSON.parse(await readFile(this.#path, "utf8")) as Record<string, unknown>;
            const { canvasService, ...snapshot } = input;
            const validated = parseWorkspaceSnapshot(input);
            if (!validated) {
                throw new Error("Workspace snapshot is required");
            }

            return {
                snapshot: parseWorkspaceSnapshot(snapshot),
                metadata: (canvasService ?? {}) as JsonObject,
            };
        } catch (error) {
            if (isNodeError(error) && error.code === "ENOENT") {
                return {
                    snapshot: undefined,
                    metadata: {},
                };
            }
            throw error;
        }
    }

    async load(): Promise<WorkspaceSnapshot | undefined> {

        return (await this.readService()).snapshot;
    }

    transaction<T>(operation: (snapshot: WorkspaceSnapshot | undefined, metadata: JsonObject) => {
        snapshot: WorkspaceSnapshot;
        metadata: JsonObject;
        result: T;
    }): Promise<T> {

        const save = this.#saving.then(async () => {

            const current = await this.readService();
            const next = operation(current.snapshot, current.metadata);
            const snapshot = parseWorkspaceSnapshot(next.snapshot);
            if (!snapshot) {
                throw new Error("Workspace snapshot is required");
            }
            const stored = {
                ...snapshot,
                canvasService: next.metadata,
            };
            parseWorkspaceSnapshot(stored);
            await mkdir(dirname(this.#path), { recursive: true });
            const temporaryPath = `${this.#path}.tmp`;
            await writeFile(temporaryPath, `${JSON.stringify(stored)}\n`, {
                encoding: "utf8",
                mode: 0o600,
            });
            await rename(temporaryPath, this.#path);

            return next.result;
        });
        this.#saving = save.then(() => {
        }, () => {
        });

        return save;
    }

    save(input: unknown, expected?: {
        snapshot: WorkspaceSnapshot | undefined;
    }): Promise<void> {

        const snapshot = parseWorkspaceSnapshot(input);
        if (!snapshot) {
            throw new Error("Workspace snapshot is required");
        }

        return this.transaction((current, metadata) => {

            if (expected && JSON.stringify(current) !== JSON.stringify(expected.snapshot)) {
                throw new Error("Workspace changed; refresh and retry the operation.");
            }

            return {
                snapshot,
                metadata,
                result: undefined,
            };
        });
    }

}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
{

    return error instanceof Error && "code" in error;
};
