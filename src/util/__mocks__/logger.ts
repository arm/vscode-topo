export const logger = {
    error: vi.fn((_message: unknown): void => {}),
    warn: vi.fn((_message: unknown): void => {}),
    info: vi.fn((_message: unknown): void => {}),
    debug: vi.fn((_message: unknown): void => {}),
    show: vi.fn(),
    dispose: vi.fn(),
};
