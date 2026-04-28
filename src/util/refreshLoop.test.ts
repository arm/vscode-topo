import { RefreshLoop } from './refreshLoop';

describe('RefreshLoop', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('runs the callback after the refresh interval', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        await refreshLoop.start();

        expect(callback).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(999);
        expect(callback).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('schedules the next run after the callback resolves', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        await refreshLoop.start();

        await jest.advanceTimersByTimeAsync(1000);
        expect(callback).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(999);
        expect(callback).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('does not run the callback after stop is called', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        await refreshLoop.start();
        refreshLoop.stop();

        await jest.advanceTimersByTimeAsync(1000);

        expect(callback).not.toHaveBeenCalled();
    });

    it('restarts the interval when start is called again', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const refreshLoop = new RefreshLoop(callback, 1000);

        await refreshLoop.start();
        await jest.advanceTimersByTimeAsync(500);
        await refreshLoop.start();

        await jest.advanceTimersByTimeAsync(999);
        expect(callback).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
