/**
 * @author Avesd
 * @package Desktop
 * @namespace Main
 * @description Operation Failure
 */

import type { CanvasErrorCode } from "../shared/canvas/contracts";
import { CanvasServiceError } from "./canvas/canvas-service";
import type { IpcFailure } from "@avesd/desktop-contracts/ipc-result";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { ZodError } from "zod";

const canvasCodes: Record<CanvasErrorCode, IpcErrorCode> = {
    INVALID_ARGUMENT: IpcErrorCode.InvalidArgument,
    UNAUTHENTICATED: IpcErrorCode.PermissionDenied,
    FORBIDDEN: IpcErrorCode.PermissionDenied,
    NOT_FOUND: IpcErrorCode.NotFound,
    REVISION_CONFLICT: IpcErrorCode.VersionConflict,
    REQUEST_ID_REUSED: IpcErrorCode.InvalidArgument,
    UNAVAILABLE: IpcErrorCode.ServiceNotReady,
};
export function canvasFailure(error: {
    code: CanvasErrorCode;
    message: string;
    currentRevision?: number;
}): OperationError {

    return new OperationError(canvasCodes[error.code], error.message, error.currentRevision);
}
export function operationFailure(error: unknown): IpcFailure {

    if (error instanceof CanvasServiceError) {
        return operationFailure(canvasFailure(error));
    }
    if (error instanceof OperationError) {
        return {
            code: error.code,
            message: error.message,
            ...(error.currentRevision === undefined ? {} : { currentRevision: error.currentRevision }),
        };
    }
    if (error instanceof ZodError) {
        return {
            code: IpcErrorCode.InvalidArgument,
            message: "Invalid request parameters.",
        };
    }

    return {
        code: IpcErrorCode.Internal,
        message: "The operation failed. Please try again.",
    };
}
