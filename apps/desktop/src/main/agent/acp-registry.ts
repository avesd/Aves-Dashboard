import { AcpProviderRegistry } from "@avesd/acp-management";
import { createRequire } from "node:module";

const moduleRequire = createRequire(import.meta.url);

/** Register adapters here; discovery and lifecycle management remain provider-neutral. */
export function createDesktopAcpRegistry(nodeExecutable: string): AcpProviderRegistry {

    const codexAdapter = moduleRequire.resolve("@agentclientprotocol/codex-acp");
    const codexRequire = createRequire(codexAdapter);
    const codexExecutable = codexRequire.resolve("@openai/codex/bin/codex.js");

    return new AcpProviderRegistry([
        {
            id: "codex",
            name: "Codex",
            command: "codex",
            loginCommand: "codex login",
            setupUrl: "https://developers.openai.com/codex/cli/",
            defaultExecutablePath: codexExecutable,
            launch: executable => {

                return {
                    command: nodeExecutable,
                    args: [codexAdapter],
                    env: {
                        CODEX_PATH: executable,
                        INITIAL_AGENT_MODE: "read-only",
                    },
                };
            },
        },
        {
            id: "claude",
            name: "Claude Code",
            command: "claude",
            loginCommand: "claude auth login",
            setupUrl: "https://code.claude.com/docs/en/setup",
            launch: executable => {

                return {
                    command: nodeExecutable,
                    args: [moduleRequire.resolve("@agentclientprotocol/claude-agent-acp/dist/index.js")],
                    env: { CLAUDE_CODE_EXECUTABLE: executable },
                };
            },
        },
        {
            id: "opencode",
            name: "OpenCode",
            command: "opencode",
            loginCommand: "opencode auth login",
            setupUrl: "https://opencode.ai/docs/",
            toolPermissionFormat: "qualified-name",
            launch: executable => {

                return {
                    command: executable,
                    args: ["acp"],
                    env: { OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: { "*": "ask" } }) },
                };
            },
        },
    ]);
}
