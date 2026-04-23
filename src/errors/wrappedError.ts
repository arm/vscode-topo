export type WrappedErrorCode = 'DOCKER' | 'CLONE' | 'CLI';

export type WrappedErrorLogLevel = 'Error' | 'Warning' | 'Info' | 'Debug';

export interface WrappedErrorLog {
    level: WrappedErrorLogLevel;
    msg: string;
}

export class WrappedError extends Error {
    constructor(
        public readonly code: WrappedErrorCode,
        message: string,
        public readonly logs: WrappedErrorLog[] = [],
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'WrappedError';
    }
}

export function isWrappedError(
    error: unknown,
    codes: WrappedErrorCode[] = [],
): error is WrappedError {
    return (
        error instanceof WrappedError &&
        (codes.length === 0 || codes.includes(error.code))
    );
}
