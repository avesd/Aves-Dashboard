/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Agent
 * @description Execution identity is required by the session host and direct host call surfaces
 */

import type { DeepSeekAgentHost } from "../../../../src/main/agent/deepseek-agent-host";
import type { SessionHost } from "../../../../src/main/agent/session-host";

/** Compile-only calls; this fixture is never executed against an Agent host. */
export async function executionIdentityCalls(host: SessionHost, direct: DeepSeekAgentHost, executionId: string, connectionId: string): Promise<void> {

    await host.prompt("Synthetic prompt", executionId);
    await host.continuePrompt("Synthetic continuation", connectionId, executionId);
    await direct.prompt("Synthetic direct prompt", executionId);
    await direct.continuePrompt("Synthetic direct continuation", connectionId, executionId);

    // @ts-expect-error The abstract host requires trusted execution identity.
    await host.prompt("Synthetic missing identity");
    // @ts-expect-error A continuation also requires trusted execution identity.
    await host.continuePrompt("Synthetic missing identity", connectionId);
    // @ts-expect-error Direct calls must not weaken the abstract host contract.
    await direct.prompt("Synthetic missing identity");
    // @ts-expect-error Direct continuations must not weaken the abstract host contract.
    await direct.continuePrompt("Synthetic missing identity", connectionId);
}
