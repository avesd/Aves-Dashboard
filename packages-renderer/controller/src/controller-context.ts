/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Root
 * @description Controller Context
 */

import type { ControllerApi } from "./controller-api";
import { createContext, useContext } from "react";

export const ControllerContext = createContext<ControllerApi | null>(null);
export function useControllerApi(): ControllerApi {

    const api = useContext(ControllerContext);
    if (!api) {
        throw new Error("Controller API is unavailable.");
    }

    return api;
}
