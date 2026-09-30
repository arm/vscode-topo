import type { WrappedError } from '../errors/wrappedError';

export type Success<T> = {
    readonly kind: 'success';
    readonly value: T;
};

/** Recognized failures are returned; unexpected exceptions still propagate. */
export type Result<T> = Success<T> | WrappedError;

export function success(): Success<void>;
export function success<T>(value: T): Success<T>;
export function success<T>(value?: T): Success<T | void> {
    return { kind: 'success', value };
}
