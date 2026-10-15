import { useEffect, useRef } from "react";

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

    const menu = useRef<HTMLDivElement>(null);
    useEffect(() => {

        menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
        const dismiss = (event: PointerEvent) => {

            if (!menu.current?.contains(event.target as Node)) {
                close();
            }
        };
        window.addEventListener("pointerdown", dismiss);
        window.addEventListener("blur", close);

        return () => {

            window.removeEventListener("pointerdown", dismiss); window.removeEventListener("blur", close);
        };
    }, [close]);

    return <div
        ref={menu}
        className="dashboard-menu"
        role="menu"
        aria-label="Dashboard actions"
        style={{
            left: Math.min(x, Math.max(8, window.innerWidth - 208)),
            top: Math.min(y, Math.max(8, window.innerHeight - (actions.length * 36 + 24))),
        }}
        onKeyDown={event => {

            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === "Escape" || event.key === "Tab") {
                event.preventDefault(); event.stopPropagation();
                close();

                return;
            }
            const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : undefined;
            if (next !== undefined) {
                event.preventDefault(); buttons[next]?.focus();
            }
        }}
    >
        {actions.map(action => {

            return <button
                key={action.label}
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {

                    action.run(); close();
                }}
            >
                {action.label}
            </button>;
        })}
    </div>;
}
