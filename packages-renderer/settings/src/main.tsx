/**
 * @author Avesd
 * @package Renderer Settings
 * @namespace Root
 * @description Main
 */

import "./styles.css";
import { AgentProviderSettings } from "./components/AgentProviderSettings";
import { AgentTierSettings } from "./components/AgentTierSettings";
import type { SettingsApi } from "@avesd/desktop-contracts/settings";
import { FrameHeader, FrameSection, Grid, GridItem, PageFrame, Stack } from "@avesd/ui-grid";
import { BirdMark } from "@avesd/ui-logo";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

export function mountSettings(root: HTMLElement, api: SettingsApi | undefined): void {

    createRoot(root).render(<StrictMode>
        <PageFrame
            width="standard"
            className="settings-page"
            header={<FrameHeader
                padding={16}
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
                <span
                    className="type-eyebrow text-muted"
                >
                    WORKSPACE / PREFERENCES
                </span>
            </FrameHeader>}
        >
            <FrameSection
                boundary="line"
                decoration="none"
            >
                <Grid
                    columns={{
                        base: 1,
                        md: 4,
                    }}
                    frame="internal"
                >
                    <GridItem
                        padding={24}
                        className="settings-index"
                    >
                        <span
                            className="type-eyebrow text-muted"
                        >
                            YOUR WORKSPACE
                        </span>
                    </GridItem>
                    <GridItem
                        span={{
                            base: 1,
                            md: 3,
                        }}
                        padding={{
                            base: 24,
                            md: 32,
                        }}
                    >
                        <Stack
                            gap={16}
                        >
                            <h1
                                className="type-display"
                            >
                                Settings
                            </h1>
                            <p
                                className="text-muted type-body"
                            >
                                A local workspace, configured around the way you work.
                            </p>
                        </Stack>
                    </GridItem>
                </Grid>
            </FrameSection>
            {api ? <>
                <AgentProviderSettings
                    api={api.providers}
                />
                <AgentTierSettings
                    api={api}
                    providersApi={api.providers}
                />
            </> : <p
                role="alert"
            >
                Settings are only available in the desktop application.
            </p>}
            <FrameSection
                decoration="none"
            >
                <div
                    className="settings-footer type-caption text-muted"
                >
                    LOCAL FIRST · AVESD
                </div>
            </FrameSection>
        </PageFrame>
    </StrictMode>);

}
