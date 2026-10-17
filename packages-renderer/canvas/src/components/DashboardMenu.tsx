/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Components
 * @description DashboardMenu
 */

import { ContextMenu, DropdownMenuItem } from "@avesd/ui-controls";

export interface DashboardMenuAction {
    readonly label: string;
    readonly disabled?: boolean;
    run(): void;
}

export function DashboardMenu({ x, y, actions, close }: {
    readonly x: number;
    readonly y: number;
    readonly actions: readonly DashboardMenuAction[];
    readonly close: () => void;
}) {

    return <ContextMenu
        x={x}
        y={y}
        label="Dashboard actions"
        onClose={close}
    >
        {actions.map(action => {

            return <DropdownMenuItem
                key={action.label}
                disabled={action.disabled}
                onSelect={() => {

                    action.run();
                }}
            >
                {action.label}
            </DropdownMenuItem>;
        })}
    </ContextMenu>;
}
