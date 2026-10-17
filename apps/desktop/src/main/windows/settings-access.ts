/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Windows
 * @description Settings Access
 */

/** Sender identity and the exact main frame are both required. */
export function isSettingsSender(event: {
    sender: unknown;
    senderFrame: unknown;
}, contents: {
    mainFrame: unknown;
} | undefined): boolean {

    return !!contents && event.sender === contents && event.senderFrame === contents.mainFrame;
}
