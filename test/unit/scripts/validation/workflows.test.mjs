/**
 * @author Avesd
 * @package GitHub
 * @namespace GitHub_Scripts_Test
 * @description Verify Action Pins.test
 */

import { findActionViolations, findWorkflowViolations } from "../../../../scripts/validation/workflows.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const hash = "a".repeat(40);
const workflow = (steps, permissions = "contents: read") => {

    return `permissions:\n  ${permissions}\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`;
};

test("accepts pinned read-only workflows using the repository Node version", () => {

    const source = workflow(`      - uses: actions/checkout@${hash}\n        with:\n          persist-credentials: false\n      - uses: actions/setup-node@${hash}\n        with:\n          node-version-file: .nvmrc\n      - uses: ./local-action\n`);
    assert.deepEqual(findWorkflowViolations(source, "ci.yml"), []);
});

test("rejects mutable Actions, credentials, and independent Node pins", () => {

    const source = workflow("      - uses: actions/checkout@v7\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 26\n", "contents: write");
    const errors = findWorkflowViolations(source, "ci.yml").join("\n");
    assert.match(errors, /read-only permissions/);
    assert.match(errors, /full commit SHA/);
    assert.match(errors, /disable persisted credentials/);
    assert.match(errors, /use .nvmrc/);
});

test("checks reusable workflow and container references", () => {

    assert.match(findWorkflowViolations("permissions: {contents: read}\njobs:\n  call:\n    uses: owner/repo/.github/workflows/build.yml@main\n", "ci.yml").join("\n"), /reusable workflow/);
    assert.match(findWorkflowViolations(workflow("      - uses: docker://alpine:latest\n"), "ci.yml").join("\n"), /digest/);
});

test("jobs cannot re-enable write permissions under read-only defaults", () => {

    const source = "permissions: {contents: read}\njobs:\n  call:\n    permissions: {contents: write}\n    steps: []\n";
    assert.match(findWorkflowViolations(source, "ci.yml").join("\n"), /jobs must not override read-only permissions/);
});

test("checks external dependencies inside local composite actions", () => {

    const source = "runs:\n  using: composite\n  steps:\n    - uses: actions/setup-node@v7\n      with:\n        node-version: 26\n    - uses: docker://alpine:latest\n";
    const errors = findActionViolations(source, "deploy-site/action.yml").join("\n");
    assert.match(errors, /full commit SHA/);
    assert.match(errors, /use .nvmrc/);
    assert.match(errors, /digest/);
});

test("accepts pinned composite actions without workflow permissions", () => {

    const source = `runs:\n  using: composite\n  steps:\n    - uses: actions/setup-node@${hash}\n      with:\n        node-version-file: .nvmrc\n    - uses: ./another-local-action\n`;
    assert.deepEqual(findActionViolations(source, "deploy-site/action.yml"), []);
});
