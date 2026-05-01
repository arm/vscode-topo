export enum Verbosity {
    off = 0,
    error = 1,
    warn = 2,
    info = 3,
    debug = 4,
}

export const logger = {
    log: jest.fn((_verbosity: Verbosity, _message: unknown): void => {}),
    error: jest.fn((_message: unknown): void => {}),
    warn: jest.fn((_message: unknown): void => {}),
    info: jest.fn((_message: unknown): void => {}),
    debug: jest.fn((_message: unknown): void => {}),
    getVerbosity: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
};
