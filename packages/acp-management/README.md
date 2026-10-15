# ACP management

`@avesd/acp-management` manages extensible ACP provider registrations,
installation discovery, launch strategies, and ACP-reported model/effort options.
It has no Electron, React, workspace, canvas, or Agent-tier dependency.
`@avesd/acp-client` remains the provider-neutral protocol/session client.

The root export contains provider contracts, `AcpProviderRegistry`, and selection
validation. The `@avesd/acp-management/node` export contains local installation
storage, executable discovery, safe process environments, provider creation,
model discovery/access checks, and process shutdown. Renderer code uses the root
contracts only; the application exposes Node operations through typed IPC.

## Register a provider

Applications register trusted launch strategies at their composition boundary:

```ts
import { AcpProviderRegistry } from "@avesd/acp-management";
import { AcpProviderInstallations, createAcpProviders } from "@avesd/acp-management/node";

const registry = new AcpProviderRegistry();
registry.register({
    id: "example-agent",
    name: "Example Agent",
    command: "example-agent",
    loginCommand: "example-agent login",
    setupUrl: "https://example.com/setup",
    toolPermissionFormat: "server-tool",
    launch: executable => ({ command: executable, args: ["acp"] }),
});
const installations = await AcpProviderInstallations.open(settingsPath, registry);
await installations.refresh();
const providers = createAcpProviders(installations);
```

IDs, duplicate registrations, installation paths, and setup links are validated.
Registration does not grant host tool access. The application must authorize
registered tools and validate every actual call. `server-tool` permission
identity uses explicit server/tool metadata; `qualified-name` uses the registered
qualified MCP identifier. Unknown identity formats require an explicit adapter
integration, not broad approval.

A definition may provide `defaultExecutablePath` for a bundled compatible CLI.
An explicit user path takes precedence. Otherwise discovery searches the system.
The installation result reports its source (`bundled`, `system`, or `custom`),
version, enablement, and availability. Saved configurations for temporarily
unregistered providers are retained but cannot be launched until registered.
Credentials are owned by the installed CLI/adapter, never stored by this library.

## Discover capabilities

`AcpModelCatalog` opens a temporary ACP connection with no MCP tools. It reads
models and efforts from the adapter, selects the requested model before reading
its effort choices, and cleans up the child process and scratch directory.
A catalog result is not an account access guarantee. `probe(selection, true)`
explicitly sends a short inference request to verify access; discovery alone
sends no inference. Timeouts and disposal close the temporary connection.

Applications supply launch-environment overrides such as their Node executable
mode. The library does not assume Electron or a UI runtime. To add an ACP to the
desktop application, add one definition in `acp-registry.ts`; provider pickers and
tier settings derive their choices from the registry rather than ID enums.

## Conversation ownership

Provider changes belong to the application's conversation manager. Avesd starts
a new conversation when choosing another ACP and retains the previous session,
including pending canvas questions. Model/effort changes keep the original ACP
connection and are allowed only while idle with no pending question. A session
reports its pinned route and actual connected choices. Chat selections update
the default for future interactive conversations; background tier routes remain
separate application policy.
