import type { TopoLogLevel } from '../services/topoCliSchema';

export type WrappedErrorCode =
    | 'DOCKER'
    | 'CLONE'
    | 'CLI'
    | 'CONFIG'
    | 'STORAGE'
    | 'TARGET'
    | 'SKILL'
    | 'INVALID_SSH_DESTINATION';

export interface WrappedErrorLog {
    readonly level: TopoLogLevel;
    readonly msg: string;
}

export class WrappedError extends Error {
    constructor(
        public readonly code: WrappedErrorCode,
        message: string,
        public readonly logs: readonly WrappedErrorLog[] = [],
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'WrappedError';
    }
}

export function isWrappedError(
    error: unknown,
    codes: readonly WrappedErrorCode[] = [],
): error is WrappedError {
    return (
        error instanceof WrappedError &&
        (codes.length === 0 || codes.includes(error.code))
    );
}
