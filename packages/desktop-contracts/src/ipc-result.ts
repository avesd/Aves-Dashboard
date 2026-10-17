/**
 * @author Avesd
 * @package Desktop Contracts
 * @namespace Root
 * @description IPC Result
 */

/** Stable string values are the wire protocol; never replace these with numeric enum ordinals. */
export enum IpcErrorCode {

    PermissionDenied = "PERMISSION_DENIED",
    InvalidArgument = "INVALID_ARGUMENT",
    VersionConflict = "VERSION_CONFLICT",
    ServiceNotReady = "SERVICE_NOT_READY",
    NotFound = "NOT_FOUND",
    Busy = "BUSY",
    Internal = "INTERNAL",
}
export interface IpcFailure {
    readonly code: IpcErrorCode;
    readonly message: string;
    readonly currentRevision?: number;
}
export type IpcResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: IpcFailure;
};

/** Expected, safe-to-display operational failure. No stack, cause or input is sent over IPC. */
export class OperationError extends Error {
    constructor(readonly code: IpcErrorCode, message: string, readonly currentRevision?: number) {

        super(message);
        this.name = "OperationError";
    }
}
export type WireApi<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? R extends Promise<infer V> ? (...args: A) => Promise<IpcResult<V>> : T[K]
        : T[K] extends object ? WireApi<T[K]> : T[K];
};

/** Created in the renderer, after contextBridge has copied the plain result object. */
export class IpcError extends Error {
    readonly code: IpcErrorCode;
    readonly currentRevision?: number;
    constructor(failure: IpcFailure) {

        super(failure.message);
        this.name = "IpcError";
        this.code = failure.code;
        this.currentRevision = failure.currentRevision;
    }
}
export function unwrapIpcResult<T>(result: IpcResult<T>): T {

    if (!result.ok) {
        throw new IpcError(result.error);
    }

    return result.value;
}
export function ipcErrorMessage(error: unknown, fallback: string): string {

    if (!(error instanceof IpcError)) {
        return error instanceof Error ? error.message : fallback;
    }
    switch (error.code) {
        case IpcErrorCode.PermissionDenied: return "This window does not have permission for this operation.";
        case IpcErrorCode.InvalidArgument: return "The request is invalid. Check your input and try again.";
        case IpcErrorCode.VersionConflict: return "Data changed. Reload the latest version before trying again.";
        case IpcErrorCode.ServiceNotReady: return "The service is not ready. Try again shortly.";
        case IpcErrorCode.Busy:
        case IpcErrorCode.Internal:
        case IpcErrorCode.NotFound: return error.message;
    }
}

/** Async methods carry results; synchronous subscription/unsubscription methods stay unchanged. */
export function createWindowClient<T extends object>(wire: WireApi<T>): T {

    const wrap = (value: unknown): unknown => {

        if (typeof value === "function") {
            return (...args: unknown[]) => {

                const result: unknown = value(...args);
                if (result instanceof Promise) {
                    return result.then(value => {

                        return unwrapIpcResult(value as IpcResult<unknown>);
                    });
                }

                return result;
            };
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([
                key,
                member,
            ]) => {

                return [
                    key,
                    wrap(member),
                ];
            }));
        }

        return value;
    };

    return wrap(wire) as T;
}
