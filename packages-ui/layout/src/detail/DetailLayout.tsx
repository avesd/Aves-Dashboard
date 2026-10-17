/**
 * @author Avesd
 * @package UI Layout
 * @namespace Detail
 * @description DetailLayout
 */

import { Grid, GridItem, Row } from "@avesd/ui-grid";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface DetailLayoutProps extends Omit<ComponentPropsWithRef<"div">, "title"> {
    readonly title: ReactNode;
    readonly titleId?: string;
    readonly actions?: ReactNode;
    readonly footer?: ReactNode;
}

export function DetailLayout({ title, titleId, actions, footer, children, ...props }: DetailLayoutProps) {

    return <div
        {...props}
    >
        <Grid
            frame="cells"
        >
            <GridItem
                padding={24}
            >
                <Row
                    align="center"
                    justify="between"
                    wrap
                >
                    <h2
                        id={titleId}
                    >
                        {title}
                    </h2>
                    {actions}
                </Row>
            </GridItem>
            <GridItem>
                {children}
            </GridItem>
            {footer && <GridItem
                padding={24}
            >
                {footer}
            </GridItem>}
        </Grid>
    </div>;
}
