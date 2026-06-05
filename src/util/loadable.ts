export type Loaded<T> = { status: 'loaded'; data: T; loading: boolean };
export type Errored = { status: 'errored'; error: Error; loading: boolean };
export type Loadable<T> = Loaded<T> | Errored;

export function loading<V, T extends Loadable<V>>(current: T): T {
    return { ...current, loading: true };
}

export function loaded<T>(data: T): Loaded<T> {
    return { status: 'loaded', data, loading: false };
}

export function errored(error: unknown): Errored {
    return {
        status: 'errored',
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
    };
}
