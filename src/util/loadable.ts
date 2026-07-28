import type { DeepReadonly } from './types';

export type Loaded<T> = {
    readonly status: 'loaded';
    readonly data: DeepReadonly<T>;
    readonly loading: boolean;
};
export type Errored = {
    readonly status: 'errored';
    readonly error: Error;
    readonly loading: boolean;
};
export type Unloaded = {
    readonly status: 'unloaded';
    readonly loading: boolean;
};
export type Loadable<T> = Loaded<T> | Errored | Unloaded;

export function loading<T extends Loadable<unknown>>(current: T): T {
    return { ...current, loading: true };
}

export function loaded<T>(
    data: DeepReadonly<T>,
    loading: boolean = false,
): Loaded<T> {
    return { status: 'loaded', data, loading };
}

export function errored(error: unknown, loading: boolean = false): Errored {
    return {
        status: 'errored',
        error: error instanceof Error ? error : new Error(String(error)),
        loading,
    };
}

export function unloaded(loading: boolean = false): Unloaded {
    return { status: 'unloaded', loading };
}
