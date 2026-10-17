/**
 * @author Avesd
 * @package Scripts
 * @namespace Root
 * @description Validate Repository Boundaries
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const violations = [];
const dependencySections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
];
const sourceExtensions = new Set([
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
]);
const nodeBuiltins = new Set(builtinModules.flatMap((name) => {

    return [
        name,
        `node:${name}`,
    ];
}));

const listDirectories = (parent) => {

    return readdirSync(parent)
        .map((name) => {

            return join(parent, name);
        })
        .filter((path) => {

            return statSync(path).isDirectory();
        });
};

const listSourceFiles = (root) => {

    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {

        const path = join(root, entry.name);
        if (entry.isDirectory()) {
            return listSourceFiles(path);
        }
        const extension = entry.name.slice(entry.name.lastIndexOf("."));

        return sourceExtensions.has(extension) ? [path] : [];
    });
};

const relativePath = (path) => {

    return path.slice(repositoryRoot.length + 1);
};

for (const directory of [
    ...listDirectories(join(repositoryRoot, "packages")),
    ...listDirectories(join(repositoryRoot, "packages-renderer")),
    ...listDirectories(join(repositoryRoot, "packages-ui")),
]) {
    const path = join(directory, "src/index.ts");
    if (!existsSync(path)) {
        continue;
    }
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest);
    if (source.statements.some((statement) => {

        return !ts.isExportDeclaration(statement) || !statement.moduleSpecifier;
    })) {
        violations.push(`${relativePath(path)}: package index must contain re-exports only`);
    }
}

const packageJsonPaths = [
    join(repositoryRoot, "package.json"),
    ...listDirectories(join(repositoryRoot, "packages-ui")).map(path => {

        return join(path, "package.json");
    }),
    ...listDirectories(join(repositoryRoot, "packages-renderer")).map(path => {

        return join(path, "package.json");
    }),
    ...listDirectories(join(repositoryRoot, "apps")).map((path) => {

        return join(path, "package.json");
    }),
    ...listDirectories(join(repositoryRoot, "packages")).map((path) => {

        return join(path, "package.json");
    }),
];

for (const packageJsonPath of packageJsonPaths.slice(1)) {
    const directory = dirname(packageJsonPath);
    for (const subtree of [
        "src",
        "eslint",
        "tests",
    ]) {
        const root = join(directory, subtree);
        if (!existsSync(root)) {
            continue;
        }
        for (const path of listSourceFiles(root)) {
            if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) || path.includes("/__tests__/")) {
                violations.push(`${relativePath(path)}: tests must live under the workspace test/ directory`);
            }
        }
    }
}

for (const packageJsonPath of packageJsonPaths) {
    const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    for (const section of dependencySections) {
        for (const [
            name,
            specifier,
        ] of Object.entries(manifest[section] ?? {})) {
            const expectedPrefix = name.startsWith("@avesd/") ? "workspace:" : "catalog:";
            if (typeof specifier !== "string" || !specifier.startsWith(expectedPrefix)) {
                violations.push(`${relativePath(packageJsonPath)}: ${section}.${name} must use ${expectedPrefix}`);
            }
        }
    }
}

const extractImports = (source) => {

    const specifiers = [];
    const patterns = [
        /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g,
        /import\s+["']([^"']+)["']/g,
    ];

    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            specifiers.push(match[1]);
        }
    }

    return specifiers;
};

const validateImports = (root, isForbidden, description) => {

    for (const path of listSourceFiles(root)) {
        const source = readFileSync(path, "utf8");
        for (const specifier of extractImports(source)) {
            if (isForbidden(specifier)) {
                violations.push(`${relativePath(path)}: ${description}: ${specifier}`);
            }
        }
    }
};

validateImports(
    join(repositoryRoot, "apps/desktop/src/renderer"),
    (specifier) => {

        return specifier === "electron" || nodeBuiltins.has(specifier);
    },
    "renderer cannot import privileged runtime module",
);

for (const directory of listDirectories(join(repositoryRoot, "packages-renderer"))) {
    validateImports(join(directory, "src"), specifier => {

        return specifier === "electron" || nodeBuiltins.has(specifier) || specifier.includes("apps/desktop") || specifier.includes("/main/") || specifier.includes("/preload/");
    }, "renderer packages cannot import desktop internals or privileged modules");
}

const uiFoundations = new Set([
    "@avesd/ui-controls",
    "@avesd/ui-grid",
    "@avesd/ui-data",
    "@avesd/ui-theme",
    "@avesd/ui-style-utils",
    "@avesd/ui-logo",
]);
const forbiddenUiImport = (specifier, foundation) => {

    if (specifier === "electron" || nodeBuiltins.has(specifier)) {
        return true;
    }
    if (!specifier.startsWith("@avesd/")) {
        return false;
    }
    if (specifier.startsWith("@avesd/configuration")) {
        return false;
    }
    if (!specifier.startsWith("@avesd/ui-")) {
        return true;
    }

    return foundation && specifier.split("/").slice(0, 2)
        .join("/") === "@avesd/ui-layout";
};
for (const directory of listDirectories(join(repositoryRoot, "packages-ui"))) {
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    const foundation = uiFoundations.has(manifest.name);
    validateImports(join(directory, "src"), specifier => {

        return forbiddenUiImport(specifier, foundation);
    }, "UI packages cannot depend on domain, renderer, privileged, or higher composition layers");
    for (const specifier of Object.keys(manifest.dependencies ?? {})) {
        if (forbiddenUiImport(specifier, foundation)) {
            violations.push(`${relativePath(directory)}/package.json: invalid UI dependency: ${specifier}`);
        }
    }
}

const publicContractRuntimeImports = new Set([
    "@avesd/kernel",
    "cordis",
    "electron",
    "react",
    "react-dom",
]);

validateImports(
    join(repositoryRoot, "packages/plugin-api/src"),
    (specifier) => {

        return publicContractRuntimeImports.has(specifier) || nodeBuiltins.has(specifier);
    },
    "plugin-api cannot depend on an implementation runtime",
);

validateImports(
    join(repositoryRoot, "packages/desktop-contracts/src"),
    specifier => {

        return nodeBuiltins.has(specifier) || [
            "electron",
            "react",
            "react-dom",
        ].includes(specifier) || specifier.startsWith("@avesd/renderer-");
    },
    "desktop contracts must remain runtime neutral",
);

if (violations.length > 0) {
    for (const violation of violations.sort()) {
        console.error(violation);
    }
    process.exitCode = 1;
} else {
    console.log("Repository boundary validation passed");
}
