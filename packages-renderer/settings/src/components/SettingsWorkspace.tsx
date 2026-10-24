/**
 * @author Avesd
 * @package Renderer Settings
 * @namespace Components
 * @description Grouped settings navigation with mounted drafts across section changes
 */

import { AgentTierSettings } from "./AgentTierSettings";
import { ApiKeySettings } from "./ApiKeySettings";
import type { SettingsApi } from "@avesd/desktop-contracts/settings";
import { Sidebar, SidebarContent, SidebarGroup, SidebarHeader, SidebarItem, SidebarLayout, SidebarMain, SidebarResizeHandle, SidebarToggle } from "@avesd/ui-layout";
import { BirdMark } from "@avesd/ui-logo";
import { Bot, KeyRound } from "lucide-react";
import { useState } from "react";

type SettingsSection = "services" | "tiers";

export function SettingsWorkspace({ api }: {
    readonly api: SettingsApi | undefined;
}) {

    const [
        section,
        setSection,
    ] = useState<SettingsSection>("services");

    return <div
        className="settings-workspace"
    >
        <header
            className="settings-window-header"
        >
            <div
                className="settings-brand"
            >
                <BirdMark
                    detail="compact"
                    width={24}
                    height={24}
                />
                <strong>Avesd</strong>
            </div>
        </header>
        <SidebarLayout
            className="settings-layout"
        >
            <Sidebar
                aria-label="Settings sidebar"
            >
                <SidebarHeader
                    title={<h1
                        className="type-subheading"
                    >
                        Settings
                    </h1>}
                >
                    <SidebarToggle
                        expandLabel="Expand settings sidebar"
                        collapseLabel="Collapse settings sidebar"
                    />
                </SidebarHeader>
                <SidebarContent
                    aria-label="Settings sections"
                >
                    <SidebarGroup
                        aria-label="Intelligence"
                    >
                        <SidebarItem
                            label="Models & services"
                            icon={<KeyRound />}
                            active={section === "services"}
                            aria-controls="settings-services"
                            onClick={() => {

                                setSection("services");
                            }}
                        />
                        <SidebarItem
                            label="Agent tiers"
                            icon={<Bot />}
                            active={section === "tiers"}
                            aria-controls="settings-tiers"
                            onClick={() => {

                                setSection("tiers");
                            }}
                        />
                    </SidebarGroup>
                </SidebarContent>
                <SidebarResizeHandle
                    label="Resize settings sidebar"
                    formatWidth={width => {

                        return `${width} pixels`;
                    }}
                />
            </Sidebar>
            <SidebarMain
                aria-label="Settings content"
            >
                {api ? <>
                    <div
                        id="settings-services"
                        hidden={section !== "services"}
                    >
                        <ApiKeySettings
                            api={api}
                        />
                    </div>
                    <div
                        id="settings-tiers"
                        hidden={section !== "tiers"}
                    >
                        <AgentTierSettings
                            api={api}
                            providersApi={api.providers}
                        />
                    </div>
                </> : <p
                    className="settings-note"
                    role="alert"
                >
                    Settings are only available in the desktop application.
                </p>}
            </SidebarMain>
        </SidebarLayout>
    </div>;
}
