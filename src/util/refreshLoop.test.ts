import { RefreshLoop } from './refreshLoop';

describe('RefreshLoop', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('runs the callback after the refresh interval', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        refreshLoop.start();

        expect(callback).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(999);
        expect(callback).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('schedules the next run after the callback resolves', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        refreshLoop.start();

        await vi.advanceTimersByTimeAsync(1000);
        expect(callback).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(999);
        expect(callback).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('does not run the callback after stop is called', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        refreshLoop.start();
        refreshLoop.stop();

        await vi.advanceTimersByTimeAsync(1000);

        expect(callback).not.toHaveBeenCalled();
    });

    it('restarts the interval when start is called again', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        refreshLoop.start();
        await vi.advanceTimersByTimeAsync(500);
        refreshLoop.start();

        await vi.advanceTimersByTimeAsync(999);
        expect(callback).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
