export type WrappedErrorCode = 'DOCKER' | 'CLONE';

export class WrappedError extends Error {
    constructor(
        public readonly code: WrappedErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'WrappedError';
    }
}

export function isWrappedError(
    error: unknown,
    codes: WrappedErrorCode[],
): error is WrappedError {
    return error instanceof WrappedError && codes.includes(error.code);
}
