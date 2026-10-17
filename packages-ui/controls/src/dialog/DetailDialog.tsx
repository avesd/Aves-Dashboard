/**
 * @author Avesd
 * @package UI Controls
 * @namespace Dialog
 * @description DetailDialog
 */

import { Button } from "../button/button";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

export interface DetailDialogProps {
    readonly open: boolean;
    readonly title: string;
    readonly closeLabel?: string;
    readonly children: ReactNode;
    readonly onClose: () => void;
}

/** Native modality keeps the background inert and contains keyboard focus. */
export function DetailDialog({ open, title, closeLabel = "Close details", children, onClose }: DetailDialogProps) {

    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {

        const dialog = ref.current;
        if (!dialog || !open) {
            return;
        }
        const origin = document.activeElement;
        dialog.showModal();

        return () => {

            dialog.close();
            if (origin instanceof HTMLElement && origin.isConnected) {
                origin.focus({ preventScroll: true });
            }
        };
    }, [open]);

    return <dialog
        ref={ref}
        className="avesd-detail-dialog"
        aria-labelledby={titleId}
        onCancel={event => {

            event.preventDefault();
            onClose();
        }}
        onKeyDown={event => {

            event.stopPropagation();
        }}
    >
        <header
            className="avesd-dialog-header"
        >
            <h2
                id={titleId}
            >
                {title}
            </h2>
            <Button
                variant="quiet"
                size="small"
                onClick={onClose}
            >
                {closeLabel}
            </Button>
        </header>
        <div
            className="avesd-dialog-body"
        >
            {children}
        </div>
    </dialog>;
}
