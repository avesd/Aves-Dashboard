/**
 * @author Avesd
 * @package Controls
 * @namespace Select
 * @description Selection Actions
 */

import { selectActionsStyles, selectActionStyles, selectIconStyles } from "./style";
import type { SelectAction } from "./types";
import type { FC } from "react";

export type SelectionActionsProps = {
    readonly actions: readonly SelectAction[];
    readonly onAction: (action: SelectAction) => void;
};

export const SelectionActions: FC<SelectionActionsProps> = (props: SelectionActionsProps) => {

    const { actions, onAction } = props;

    return (<>
        {actions.length > 0 && (<div
            className={selectActionsStyles()}
        >
            {actions.map((action) => {

                const content = (<>
                    {action.icon && (<span
                        className={selectIconStyles()}
                        aria-hidden="true"
                    >
                        {action.icon}
                    </span>)}
                    {action.label}
                </>);
                const actionClass = selectActionStyles();
                if (action.href !== undefined) {
                    return (<a
                        key={action.id}
                        href={action.disabled ? undefined : action.href}
                        target={action.target}
                        rel={action.rel}
                        aria-disabled={action.disabled || undefined}
                        data-disabled={action.disabled ? "" : undefined}
                        tabIndex={action.disabled ? -1 : undefined}
                        className={actionClass}
                        onClick={(event) => {

                            if (action.disabled) {
                                event.preventDefault();

                                return;
                            }
                            onAction(action);
                        }}
                    >
                        {content}
                    </a>);
                }

                return (<button
                    key={action.id}
                    type="button"
                    disabled={action.disabled}
                    data-disabled={action.disabled ? "" : undefined}
                    className={actionClass}
                    onClick={() => {

                        onAction(action);
                    }}
                >
                    {content}
                </button>);
            })}
        </div>)}
    </>);
};
