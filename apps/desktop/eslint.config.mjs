/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description ESLint Config
 */

import { createAvesdConfig } from "@avesd/configuration/eslint";
import globals from "globals";

export default [
    ...createAvesdConfig(import.meta.dirname),
    {
        files: ["test/**/*.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
    },
];
