export type Loadable<T> =
    | { status: 'loaded'; data: T; loading: boolean }
    | { status: 'errored'; error: Error; loading: boolean };

export type LoadableStatus = Loadable<unknown>['status'];

export function loading<T>(current: Loadable<T>): Loadable<T> {
    return { ...current, loading: true };
}

export function loaded<T>(data: T): Loadable<T> {
    return { status: 'loaded', data, loading: false };
}

export function errored(error: unknown): Loadable<never> {
    return {
        status: 'errored',
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
    };
}
