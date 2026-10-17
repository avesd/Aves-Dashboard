/**
 * @author Avesd
 * @package Workspace Model
 * @namespace Canvas
 * @description Canvas Metadata
 */

/** Canvas resource metadata, independent of any component rendering format. */

import type { Dashboard, JsonObject } from "../workspace/workspace-model";

export interface CanvasMetadata {
    readonly revision: number;
}

function storedMetadata(dashboard: Dashboard): JsonObject {

    const value = dashboard.viewState.canvas;
    if (value === undefined) {
        return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid canvas metadata.");
    }

    return value as JsonObject;
}

export function readCanvasMetadata(dashboard: Dashboard): CanvasMetadata {

    const revision = storedMetadata(dashboard).revision ?? 0;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) {
        throw new Error("Invalid canvas revision.");
    }

    return { revision };
}

export function writeCanvasMetadata(dashboard: Dashboard, metadata: CanvasMetadata): JsonObject {

    return {
        ...dashboard.viewState,
        canvas: {
            ...storedMetadata(dashboard),
            revision: metadata.revision,
        },
    };
}
