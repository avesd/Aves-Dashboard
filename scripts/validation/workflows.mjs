/**
 * @author Avesd
 * @package GitHub
 * @namespace GitHub_Scripts
 * @description Verify Action Pins
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const findStepViolations = (steps, fileName) => {

    const violations = [];
    for (const [
        index,
        step,
    ] of steps.entries()) {
        const reference = step.uses;
        if (!reference || reference.startsWith("./")) {
            continue;
        }
        if (reference.startsWith("docker://")) {
            if (!/@sha256:[0-9a-f]{64}$/.test(reference)) {
                violations.push(`${fileName}:${index}: Docker actions must use a digest`);
            }
            continue;
        }
        if (!/@[0-9a-f]{40}$/.test(reference)) {
            violations.push(`${fileName}:${index}: Actions must use a full commit SHA`);
        }
        if (reference.startsWith("actions/checkout@") && step.with?.["persist-credentials"] !== false) {
            violations.push(`${fileName}:${index}: checkout must disable persisted credentials`);
        }
        if (reference.startsWith("actions/setup-node@") && step.with?.["node-version-file"] !== ".nvmrc") {
            violations.push(`${fileName}:${index}: setup-node must use .nvmrc`);
        }
    }

    return violations;
};

export const findActionViolations = (source, fileName) => {

    const action = parse(source);
    if (action.runs?.using !== "composite") {
        return [];
    }

    return findStepViolations(action.runs.steps ?? [], fileName);
};

export const findWorkflowViolations = (source, fileName) => {

    const violations = [];
    const workflow = parse(source);
    if (workflow.permissions?.contents !== "read" || Object.values(workflow.permissions ?? {}).some((value) => {

        return value !== "read" && value !== "none";
    })) {
        violations.push(`${fileName}: workflows must default to read-only permissions`);
    }
    for (const [
        name,
        job,
    ] of Object.entries(workflow.jobs ?? {})) {
        if (job.permissions && (typeof job.permissions === "string" || Object.values(job.permissions).some((value) => {

            return value !== "read" && value !== "none";
        }))) {
            violations.push(`${fileName}:${name}: jobs must not override read-only permissions`);
        }
        violations.push(...findStepViolations(job.steps ?? [], `${fileName}:${name}`));
        if (job.uses && !job.uses.startsWith("./") && !/@[0-9a-f]{40}$/.test(job.uses)) {
            violations.push(`${fileName}:${name}: reusable workflow must use a full commit SHA`);
        }
    }

    return violations;
};

const findActionFiles = (directory) => {

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {

        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            return findActionFiles(path);
        }

        return /^action\.ya?ml$/.test(entry.name) ? [path] : [];
    });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const directory = new URL("../../.github/workflows/", import.meta.url);
    const files = readdirSync(directory).filter((file) => {

        return /\.ya?ml$/.test(file);
    });
    const errors = files.flatMap((file) => {

        return findWorkflowViolations(readFileSync(new URL(file, directory), "utf8"), file);
    });
    const actionsDirectory = fileURLToPath(new URL("../../.github/actions/", import.meta.url));
    const actionFiles = existsSync(actionsDirectory) ? findActionFiles(actionsDirectory) : [];
    errors.push(...actionFiles.flatMap((file) => {

        return findActionViolations(readFileSync(file, "utf8"), relative(actionsDirectory, file));
    }));
    if (errors.length) {
        console.error(errors.join("\n"));
        process.exitCode = 1;
    }
    else {
        console.log(`Verified workflow policy in ${files.length} workflows and ${actionFiles.length} local actions.`);
    }
}
