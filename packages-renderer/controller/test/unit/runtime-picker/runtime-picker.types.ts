/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Test_Unit_RuntimePicker
 * @description Runtime picker exposes intent commands and explicit dependencies
 */

import type { useRuntimePicker } from "../../../src/runtime-picker/useRuntimePicker";

/** Compile-only checks; no React hook is invoked. */
export function checkPickerCommands(picker: ReturnType<typeof useRuntimePicker>): void {

    picker.chooseProvider("synthetic-provider");
    picker.chooseModel("synthetic-model");
    picker.chooseEffort("");
    picker.refreshOptions();
    picker.close();
    // @ts-expect-error Draft transitions belong to intent commands inside the hook.
    void picker.setDraft;
    // @ts-expect-error View callers cannot independently change request feedback.
    void picker.setMessage;
    // @ts-expect-error Popover closure is an explicit command.
    void picker.setOpen;
    // @ts-expect-error Refresh bookkeeping remains private.
    void picker.setRefresh;
}
