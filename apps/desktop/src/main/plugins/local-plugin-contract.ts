/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Local Plugin Contract
 */

import { parseWebUrl } from "../../shared/browser/web-surface";
import * as z from "zod";

export const draftIdSchema = z.uuid();
export const revisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const localManifestSchema = z.strictObject({
    browser: z.strictObject({
        origins: z.array(z.string().max(4096)
            .refine(value => {

                try { return parseWebUrl(value).origin === value; } catch { return false; }
            }, "Use an HTTPS origin or loopback HTTP origin.")).min(1)
            .max(16),
        session: z.strictObject({
            name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
            shared: z.boolean(),
        }).optional(),
    }).optional(),
    capabilities: z.array(z.enum([
        "catalog",
        "navigation",
        "management",
        "files",
        "sqlite",
        "resources",
        "agent",
    ])).max(7)
        .optional(),
    apiVersion: z.literal(1),
    id: z.string().regex(/^avesd\.local\.[a-z][a-z0-9-]{0,63}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/)
        .max(32),
    displayName: z.string().trim()
        .min(1)
        .max(80),
    widgetTypeId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    size: z.strictObject({
        width: z.number().int()
            .min(4)
            .max(24),
        height: z.number().int()
            .min(4)
            .max(32),
    }),
});
const selector = z.string().min(1)
    .max(256);
export const widgetTestsSchema = z.array(z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("click"),
        selector,
    }),
    z.strictObject({
        type: z.literal("fill"),
        selector,
        value: z.string().max(4096),
    }),
    z.strictObject({
        type: z.literal("expectText"),
        selector,
        text: z.string().max(4096),
    }),
])).min(1)
    .max(32)
    .refine((steps) => {

        return steps.some((step) => {

            return step.type === "expectText";
        });
    }, "Include a text assertion.");
export const draftContentSchema = z.strictObject({
    manifest: localManifestSchema,
    source: z.string().min(1)
        .max(65_536)
        .refine((source) => {

            return Buffer.byteLength(source, "utf8") <= 65_536;
        }, "Source exceeds 64 KiB."),
    tests: widgetTestsSchema,
});
