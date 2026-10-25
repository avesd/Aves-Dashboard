/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Browser
 * @description Safe classification of known background collection failures
 */

const messages = {
    "interaction-required": "Open the page to complete login, then close its window and refresh.",
    "load-failed": "The page could not load. Check the connection and retry.",
    "fields-missing": "Expected fields were not found. Check login or repair the extraction rules.",
} as const;

export class BrowserCollectionError extends Error {
    constructor(readonly code: keyof typeof messages) {

        super(messages[code]);
        this.name = "BrowserCollectionError";
    }
}

export function browserCollectionMessage(error: unknown): string {

    if (error instanceof BrowserCollectionError) {
        return messages[error.code];
    }

    return "Collection failed. Open the page and check its rules before retrying.";
}
