export type TopoErrorCode = 'DOCKER' | 'CLONE' | 'CLI';

export interface TopoLogEntry {
    time: string;
    level: string;
    msg: string;
}

export class TopoError extends Error {
    constructor(
        public readonly code: TopoErrorCode,
        message?: string,
        options?: ErrorOptions & { logEntries?: TopoLogEntry[] },
    ) {
        super(message, options);
        this.name = 'TopoError';
        this.logEntries = options?.logEntries ?? [];
    }

    public readonly logEntries: TopoLogEntry[];
}

export function isTopoError(error: unknown): error is TopoError {
    return error instanceof TopoError;
}
