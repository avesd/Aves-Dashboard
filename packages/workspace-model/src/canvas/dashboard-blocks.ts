/**
 * @author Avesd
 * @package Workspace Model
 * @namespace Canvas
 * @description Dashboard Blocks
 */

/** Runtime-neutral source, data, and capability contracts for dashboard blocks. */

import type { Dashboard, JsonObject } from "../workspace/workspace-model";
import * as z from "zod";

export const blockIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const blockRevisionSchema = z.number().int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER);
function validJson(value: unknown, depth = 0): boolean {

    if (depth > 16) {
        return false;
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return true;
    }
    if (typeof value === "number") {
        return Number.isFinite(value);
    }
    if (Array.isArray(value)) {
        return value.every((entry: unknown) => {

            return validJson(entry, depth + 1);
        });
    }
    if (value && typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        return Object.entries(value).every(([
            key,
            entry,
        ]) => {

            return ![
                "__proto__",
                "prototype",
                "constructor",
            ].includes(key) && validJson(entry, depth + 1);
        });
    }

    return false;
}
export const blockDataSchema = z.record(z.string(), z.unknown()).refine(value => {

    return validJson(value) && new TextEncoder().encode(JSON.stringify(value)).length <= 32_768;
}, "Use a JSON object of at most 32 KiB and 16 levels.")
    .transform(value => {

        return value as JsonObject;
    });
export const blockQuestionOwnerSchema = z.strictObject({
    sessionId: z.uuid(),
    connectionId: z.uuid(),
    turnId: z.uuid(),
});
export type BlockQuestionOwner = z.infer<typeof blockQuestionOwnerSchema>;
export const blockQuestionFieldSchema = z.strictObject({
    key: blockIdSchema,
    label: z.string().trim()
        .min(1)
        .max(300),
    type: z.enum([
        "single_choice",
        "multiple_choice",
        "text",
    ]),
    required: z.boolean().default(true),
    options: z.array(z.strictObject({
        value: blockIdSchema,
        label: z.string().trim()
            .min(1)
            .max(300),
    })).min(1)
        .max(32)
        .optional(),
}).refine(
    field => {

        return field.type === "text" ? field.options === undefined : !!field.options;
    },
    "Choice fields require options; text fields have no options.",
)
    .refine(
        field => {

            return !field.options || new Set(field.options.map(option => {

                return option.value;
            })).size === field.options.length;
        },
        "Option values must be unique.",
    );
export const blockQuestionInputSchema = z.strictObject({
    id: blockIdSchema,
    title: z.string().trim()
        .min(1)
        .max(1000),
    fields: z.array(blockQuestionFieldSchema).min(1)
        .max(8),
}).refine(
    question => {

        return new Set(question.fields.map(field => {

            return field.key;
        })).size === question.fields.length;
    },
    "Question field keys must be unique.",
);
export const blockQuestionSchema = blockQuestionInputSchema.safeExtend({
    generation: z.uuid(),
    revision: blockRevisionSchema,
    owner: blockQuestionOwnerSchema,
    submission: z.strictObject({
        id: z.uuid(),
        answers: blockDataSchema,
        acceptedAt: z.number().int()
            .nonnegative(),
    }).optional(),
});
export type BlockQuestion = z.infer<typeof blockQuestionSchema>;

function questionAnswerFailure(message: string): z.ZodError {

    return new z.ZodError([
        {
            code: "custom",
            path: [],
            message,
        },
    ]);
}

/** Validate answer semantics independently of the generated document. */
export function questionAnswers(question: Pick<BlockQuestion, "fields">, input: unknown): BlockData {

    const supplied = blockDataSchema.parse(input);
    if (Object.keys(supplied).some(key => {

        return !question.fields.some(field => {

            return field.key === key;
        });
    })) {
        throw questionAnswerFailure("Unknown answer field.");
    }
    const answers: Record<string, JsonObject[string]> = {};
    for (const field of question.fields) {
        const value = supplied[field.key];
        if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
            if (field.required) {
                throw questionAnswerFailure("A required answer is missing.");
            }
            continue;
        }
        if (field.type === "text") {
            if (typeof value !== "string" || !value.trim() || value.length > 4096) {
                throw questionAnswerFailure("Invalid text answer.");
            }
            answers[field.key] = value.trim();
        } else {
            const values = field.type === "single_choice" ? [value] : value;
            if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length
                || values.some(option => {

                    return typeof option !== "string" || !field.options?.some(candidate => {

                        return candidate.value === option;
                    });
                })) {
                throw questionAnswerFailure("Invalid choice answer.");
            }
            answers[field.key] = field.type === "single_choice" ? values[0] as string : [...values].sort() as string[];
        }
    }

    return blockDataSchema.parse(answers);
}
export const blockSourceSchema = z.strictObject({
    html: z.string().max(65_536),
    css: z.string().max(32_768)
        .default(""),
    js: z.string().max(32_768)
        .default(""),
});
export const blockBoundsSchema = z.strictObject({
    x: z.number().min(-1_000_000)
        .max(1_000_000),
    y: z.number().min(-1_000_000)
        .max(1_000_000),
    width: z.number().min(40)
        .max(4_000),
    height: z.number().min(30)
        .max(4_000),
});
export const blockBindingSchema = z.strictObject({
    key: blockIdSchema,
    sourceId: z.string().min(1)
        .max(160),
    fields: z.array(blockIdSchema).max(64)
        .optional(),
});
export const blockActionSchema = z.strictObject({
    id: blockIdSchema,
    label: z.string().min(1)
        .max(160),
    capability: z.enum([
        "block.set_data",
        "canvas.open",
        "agent.task",
        "agent.respond",
    ]),
    parameters: blockDataSchema.default({}),
    inputFields: z.array(blockIdSchema).max(32)
        .default([]),
});
export const dashboardBlockSchema = z.strictObject({
    id: blockIdSchema,
    generation: z.uuid(),
    description: z.string().max(512),
    source: blockSourceSchema,
    bounds: blockBoundsSchema,
    revision: blockRevisionSchema,
    data: blockDataSchema,
    dataRevision: blockRevisionSchema,
    viewState: blockDataSchema,
    stateRevision: blockRevisionSchema,
    bindings: z.array(blockBindingSchema).max(16),
    actions: z.array(blockActionSchema).max(16),
    question: blockQuestionSchema.nullable().default(null),
});
export type DashboardBlock = z.infer<typeof dashboardBlockSchema>;
export type BlockData = JsonObject;
export type BlockSource = DashboardBlock["source"];
export type BlockAction = DashboardBlock["actions"][number];
export const blockChangeSchema = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("create"),
        id: blockIdSchema,
        description: z.string().max(512)
            .default(""),
        source: blockSourceSchema,
        bounds: blockBoundsSchema,
        data: blockDataSchema.default({}),
        bindings: z.array(blockBindingSchema).max(16)
            .default([]),
        actions: z.array(blockActionSchema).max(16)
            .default([]),
        question: blockQuestionInputSchema.optional(),
    }),
    z.strictObject({
        type: z.literal("update"),
        id: blockIdSchema,
        description: z.string().max(512)
            .optional(),
        source: blockSourceSchema.optional(),
        bounds: blockBoundsSchema.optional(),
        data: blockDataSchema.optional(),
        expectedDataRevision: blockRevisionSchema.optional(),
        bindings: z.array(blockBindingSchema).max(16)
            .optional(),
        actions: z.array(blockActionSchema).max(16)
            .optional(),
        question: blockQuestionInputSchema.nullable().optional(),
    }).refine(value => {

        return value.data === undefined || value.expectedDataRevision !== undefined;
    }, "Data updates require expectedDataRevision.")
        .refine(
            value => {

                return !value.question || value.source !== undefined;
            },
            "Replacing a question requires its new presentation source.",
        ),
    z.strictObject({
        type: z.literal("move"),
        id: blockIdSchema,
        bounds: blockBoundsSchema,
    }),
    z.strictObject({
        type: z.literal("remove"),
        id: blockIdSchema,
    }),
]);
export type BlockChange = z.infer<typeof blockChangeSchema>;
export function readDashboardBlocks(dashboard: Dashboard): DashboardBlock[] {

    const blocks = z.array(dashboardBlockSchema).max(64)
        .parse(dashboard.viewState.blocks ?? []);
    if (new Set(blocks.map(block => {

        return block.id;
    })).size !== blocks.length) {
        throw new Error("Duplicate block IDs.");
    }
    for (const block of blocks) {
        if (new Set(block.bindings.map(binding => {

            return binding.key;
        })).size !== block.bindings.length || new Set(block.actions.map(action => {

            return action.id;
        })).size !== block.actions.length) {
            throw new Error("Duplicate block binding or action IDs.");
        }
    }

    return blocks;
}
export function writeDashboardBlocks(dashboard: Dashboard, blocks: readonly DashboardBlock[]): JsonObject {

    return {
        ...dashboard.viewState,
        blocks,
    };
}
export function changeDashboardBlocks(current: readonly DashboardBlock[], changes: readonly BlockChange[], owner?: BlockQuestionOwner): DashboardBlock[] {

    const blocks = structuredClone([...current]);
    for (const change of changes) {
        const question = ("question" in change && change.question) ? (() => {

            if (!owner) {
                throw new Error("Only a live Agent session can ask a question.");
            }

            return {
                ...change.question,
                generation: crypto.randomUUID(),
                revision: (blocks.find(block => {

                    return block.id === change.id;
                })?.question?.revision ?? 0) + 1,
                owner,
            };
        })() : null;
        const index = blocks.findIndex(block => {

            return block.id === change.id;
        });
        if (change.type === "create") {
            if (index !== -1) {
                throw new Error("Block already exists.");
            }
            const content = {
                id: change.id,
                description: change.description,
                source: change.source,
                bounds: change.bounds,
                data: change.data,
                bindings: change.bindings,
                actions: change.actions,
                question,
            };
            blocks.push({
                ...content,
                generation: crypto.randomUUID(),
                revision: 1,
                dataRevision: 0,
                viewState: {},
                stateRevision: 0,
            });
        } else {
            const block = blocks[index];
            if (!block) {
                throw new Error("Block is unavailable.");
            }
            if (change.type === "remove") {
                blocks.splice(index, 1);
            } else if (change.type === "move") {
                blocks[index] = {
                    ...block,
                    bounds: change.bounds,
                };
            } else {
                if (block.question && (change.question !== undefined || change.source !== undefined || change.actions !== undefined)
                    && block.question.owner.sessionId !== owner?.sessionId) {
                    throw new Error("Only the asking session can replace a question document.");
                }
                if (change.data !== undefined && change.expectedDataRevision !== block.dataRevision) {
                    throw new Error("Block data changed; refresh before updating.");
                }
                blocks[index] = {
                    ...block,
                    description: change.description ?? block.description,
                    source: change.source ?? block.source,
                    bounds: change.bounds ?? block.bounds,
                    data: change.data ?? block.data,
                    dataRevision: block.dataRevision + (change.data === undefined ? 0 : 1),
                    question: change.question === undefined ? block.question : question,
                    revision: block.revision + (change.source === undefined ? 0 : 1),
                    bindings: change.bindings ?? block.bindings,
                    actions: change.actions ?? block.actions,
                };
            }
        }
    }

    return z.array(dashboardBlockSchema).max(64)
        .parse(blocks);
}
