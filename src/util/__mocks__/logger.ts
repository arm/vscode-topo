export const logger = {
    error: vi.fn((_message: string | Error, ..._args: unknown[]): void => {}),
    warn: vi.fn((_message: string, ..._args: unknown[]): void => {}),
    info: vi.fn((_message: string, ..._args: unknown[]): void => {}),
    debug: vi.fn((_message: string, ..._args: unknown[]): void => {}),
    show: vi.fn(),
    dispose: vi.fn(),
};
