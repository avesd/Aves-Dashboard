/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Validation
 * @description File Headers
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
]);
const GENERATED = new Set([
    "node_modules",
    ".git",
    ".pnpm-store",
    ".turbo",
    "dist",
    "out",
    "build",
    "coverage",
    "release",
]);
const FIELD = /^\s*\*\s*@(author|package|namespace|description)\b[ \t]*(.*)$/;

const title = (value: string): string => {

    return value.split(/[-_]/).map((word) => {

        if ([
            "api",
            "ui",
            "ipc",
            "css",
            "json",
        ].includes(word.toLowerCase())) {
            return word.toUpperCase();
        }

        return word.charAt(0).toUpperCase() + word.slice(1);
    })
        .join(" ");
};

const workspaceGroups = (root: string): string[] => {

    const workspace: unknown = parse(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"));
    if (!workspace || typeof workspace !== "object" || !("packages" in workspace) || !Array.isArray(workspace.packages)) {
        throw new Error("pnpm-workspace.yaml must declare workspace packages");
    }

    return workspace.packages.map((pattern: unknown) => {

        if (typeof pattern !== "string" || !/^[a-z][a-z-]*\/\*$/.test(pattern)) {
            throw new Error("File headers require immediate workspace patterns such as packages/*");
        }

        return pattern.slice(0, -2);
    });
};

export const sourcePaths = (root = ROOT): string[] => {

    const files: string[] = [];
    const walk = (directory: string, recurse: boolean): void => {

        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink()) {
                continue;
            }
            if (entry.isDirectory() && recurse) {
                if (GENERATED.has(entry.name) && path !== join(root, "scripts/release")) {
                    continue;
                }
                walk(path, true);
            } else if (entry.isFile() && EXTENSIONS.has(extname(path)) && !/\.d\.(?:ts|mts|cts)$/.test(path)) {
                files.push(path);
            }
        }
    };
    walk(root, false);
    for (const name of [
        "scripts",
        ".github",
    ]) {
        const path = join(root, name);
        if (existsSync(path)) {
            walk(path, true);
        }
    }
    for (const group of workspaceGroups(root)) {
        const parent = join(root, group);
        if (!existsSync(parent)) {
            continue;
        }
        for (const entry of readdirSync(parent, { withFileTypes: true })) {
            const path = join(parent, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith(".") && existsSync(join(path, "package.json"))) {
                walk(path, true);
            }
        }
    }

    return files.sort();
};

const headerDefaults = (root: string, path: string): {
    package: string;
    namespace: string;
    description: string;
} => {

    const parts = relative(root, path).split(sep);
    let packageName: string;
    let directory: string[];
    if (parts.length === 1) {
        packageName = "Workspace";
        directory = [];
    } else if (parts[0] === "scripts") {
        packageName = "Scripts";
        directory = parts.slice(0, -1);
    } else if (parts[0] === ".github") {
        packageName = "GitHub";
        directory = [
            "GitHub",
            ...parts.slice(1, -1),
        ];
    } else {
        const manifest: unknown = JSON.parse(readFileSync(join(root, ...parts.slice(0, 2), "package.json"), "utf8"));
        if (!manifest || typeof manifest !== "object" || !("name" in manifest) || typeof manifest.name !== "string") {
            throw new Error(`Workspace must declare a package name: ${parts.slice(0, 2).join("/")}`);
        }
        packageName = title(manifest.name.replace(/^@[^/]+\//, ""));
        directory = parts.slice(2, -1);
        if (directory[0] === "src") {
            directory = directory.slice(1);
        }
    }

    return {
        package: packageName,
        namespace: directory.map((segment) => {

            return title(segment).replaceAll(" ", "");
        }).join("_") || "Root",
        description: title(basename(path, extname(path))),
    };
};

const withHeader = (content: string, defaults: ReturnType<typeof headerDefaults>): string => {

    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const bom = content.startsWith("\uFEFF") ? "\uFEFF" : "";
    const source = content.slice(bom.length);
    let prefix = bom;
    let body = source;
    if (source.startsWith("#!")) {
        const end = source.indexOf("\n");
        if (end === -1) {
            prefix += source + eol;
            body = "";
        } else {
            prefix += source.slice(0, end + 1);
            body = source.slice(end + 1);
        }
    }
    body = body.replace(/^(?:\r?\n)*/, "");
    const candidate = /^\/\*\*[\s\S]*?\*\//.exec(body)?.[0];
    const lines = candidate?.split(/\r?\n/).slice(1, -1) ?? [];
    const hasMetadata = lines.some((line) => {

        return FIELD.test(line);
    });
    const fields: Record<string, string> = {};
    const extras: string[] = [];
    if (hasMetadata && candidate) {
        for (const line of lines) {
            const match = FIELD.exec(line);
            if (match) {
                fields[match[1]!] = match[2]!.trim();
            } else {
                extras.push(line);
            }
        }
        body = body.slice(candidate.length).replace(/^(?:\r?\n)*/, "");
    }
    const header = [
        "/**",
        " * @author Avesd",
        ` * @package ${fields.package || defaults.package}`,
        ` * @namespace ${fields.namespace || defaults.namespace}`,
        ` * @description ${fields.description || defaults.description}`,
        ...extras,
        " */",
        "",
        "",
    ].join(eol);

    return prefix + header + body;
};

export const maintainHeaders = (mode: "check" | "fix", root = ROOT, report: (message: string) => void = console.log): number => {

    const files = sourcePaths(root);
    let changed = 0;
    for (const path of files) {
        const content = readFileSync(path, "utf8");
        const updated = withHeader(content, headerDefaults(root, path));
        if (updated === content) {
            continue;
        }
        changed++;
        report(relative(root, path));
        if (mode === "fix") {
            writeFileSync(path, updated);
        }
    }
    const outcome = mode === "fix" ? "fixed" : "need fixes";
    report(`${mode}: ${files.length} files checked, ${changed} files ${outcome}`);

    return mode === "check" && changed > 0 ? 1 : 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const mode = process.argv[2];
    if (mode !== "check" && mode !== "fix") {
        console.error("Usage: node scripts/validation/file-headers.ts <check|fix>");
        process.exitCode = 1;
    } else {
        process.exitCode = maintainHeaders(mode);
    }
}
