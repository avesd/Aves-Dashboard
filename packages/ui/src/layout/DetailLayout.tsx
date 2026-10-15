import type { FrameProps } from "./Frame";
import { Frame, FrameSection } from "./Frame";
import type { ReactNode } from "react";

export interface DetailLayoutProps extends Omit<FrameProps, "title"> {
    readonly title: ReactNode;
    readonly titleId?: string;
    readonly actions?: ReactNode;
    readonly footer?: ReactNode;
}

export function DetailLayout({ title, titleId, actions, footer, children, ...props }: DetailLayoutProps) {

    return <Frame
        {...props}
    >
        <FrameSection
            className="avesd-detail-heading"
        >
            <h2
                id={titleId}
            >
                {title}
            </h2>
            {actions && <div
                className="avesd-detail-actions"
            >
                {actions}
            </div>}
        </FrameSection>
        {children}
        {footer && <FrameSection>
            {footer}
        </FrameSection>}
    </Frame>;
}
