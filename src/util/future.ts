export interface Future<T> {
    get(): T | undefined;
    promise: Promise<T>;
}

export function future<T>(fn: () => Promise<T>): Future<T> {
    let result: T | undefined;
    const promise = fn().then((v) => {
        result = v;
        return v;
    });

    return {
        get: () => result,
        promise,
    };
}
