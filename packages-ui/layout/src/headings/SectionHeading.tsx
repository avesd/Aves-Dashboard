/**
 * @author Avesd
 * @package UI Layout
 * @namespace Headings
 * @description SectionHeading
 */

import { Grid, GridItem, Row, Stack } from "@avesd/ui-grid";
import type { ReactNode } from "react";

export interface SectionHeadingProps {
    readonly eyebrow?: string;
    readonly title: string;
    readonly description?: ReactNode;
    readonly actions?: ReactNode;
}

export function SectionHeading({ eyebrow, title, description, actions }: SectionHeadingProps) {

    return <Grid
        columns={{
            base: 1,
            md: 4,
        }}
        frame="internal"
        className="avesd-section-heading"
    >
        <GridItem
            padding={{
                base: 16,
                md: 24,
            }}
        >
            <p
                className="type-eyebrow text-muted"
            >
                {eyebrow}
            </p>
        </GridItem>
        <GridItem
            span={{
                base: 1,
                md: 3,
            }}
            padding={{
                base: 16,
                md: 24,
            }}
        >
            <Stack
                gap={8}
            >
                <Row
                    justify="between"
                    align="center"
                    wrap
                >
                    <h2
                        className="type-heading"
                    >
                        {title}
                    </h2>
                    {actions}
                </Row>
                {description && <div
                    className="type-supporting text-muted"
                >
                    {description}
                </div>}
            </Stack>
        </GridItem>
    </Grid>;
}
