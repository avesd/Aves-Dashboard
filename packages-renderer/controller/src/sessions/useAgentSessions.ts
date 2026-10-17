/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Sessions
 * @description UseAgentSessions
 */

import type { ControllerApi } from "../controller-api";
import type { AgentSessionSnapshot, AgentSessionSummary } from "@avesd/desktop-contracts/agent/sessions";
import { useEffect, useState } from "react";

export function useAgentSessions(api: ControllerApi, fail: (cause: unknown) => void) {

    const [
        sessions,
        setSessions,
    ] = useState<readonly AgentSessionSummary[]>([]);
    const [
        session,
        setSession,
    ] = useState<AgentSessionSnapshot | null>(null);
    useEffect(() => {

        let active = true;
        let generation = 0;
        const refresh = async () => {

            const current = ++generation;
            try {
                const listing = await api.agentSessions.list();
                const selected = listing.selectedId ? await api.agentSessions.read(listing.selectedId) : null;
                if (active && current === generation) {
                    setSessions(listing.sessions);
                    setSession(selected);
                }
            } catch (cause) {
                if (active) {
                    fail(cause);
                }
            }
        };
        const dispose = api.agentSessions.subscribe(() => {

            void refresh();
        });
        void refresh();

        return () => {

            active = false;
            dispose();
        };
    }, [
        api.agentSessions,
        fail,
    ]);

    return {
        sessions,
        session,
    };
}
