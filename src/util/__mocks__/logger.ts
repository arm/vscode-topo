export enum Verbosity {
    off = 0,
    error = 1,
    warn = 2,
    info = 3,
    debug = 4,
}

export const logger = {
    log: vi.fn((_verbosity: Verbosity, _message: unknown): void => {}),
    error: vi.fn((_message: unknown): void => {}),
    warn: vi.fn((_message: unknown): void => {}),
    info: vi.fn((_message: unknown): void => {}),
    debug: vi.fn((_message: unknown): void => {}),
    getVerbosity: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
};
