/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Helpers
 * @description Explicitly controlled promises for asynchronous boundary tests
 */

export function deferred<T = void>() {

    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {

        resolve = resolvePromise;
        reject = rejectPromise;
    });

    return {
        promise,
        resolve,
        reject,
    };
}
