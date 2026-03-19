export type TopoErrorCode = 'DOCKER' | 'CLONE';

export class TopoError extends Error {
    constructor(
        public readonly code: TopoErrorCode,
        message?: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'TopoError';
    }
}

export function isTopoError(error: unknown): error is TopoError {
    return error instanceof TopoError;
}
