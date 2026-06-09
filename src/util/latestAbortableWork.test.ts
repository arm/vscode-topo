import { LatestAbortableWork } from './latestAbortableWork';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe('LatestAbortableWork', () => {
    it('runs work with an active abort signal', async () => {
        const abortableWork = new LatestAbortableWork();
        let receivedSignal: AbortSignal | undefined;

        const result = await abortableWork.run(async (signal) => {
            receivedSignal = signal;
            return 'done';
        });

        expect(result).toBe('done');
        expect(receivedSignal?.aborted).toBe(false);
        expect(abortableWork.isRunning()).toBe(false);
    });

    it('reports running while work is pending', async () => {
        const abortableWork = new LatestAbortableWork();
        const pending = deferred<string>();

        const runningWork = abortableWork.run(() => pending.promise);

        expect(abortableWork.isRunning()).toBe(true);

        pending.resolve('done');
        await expect(runningWork).resolves.toBe('done');
        expect(abortableWork.isRunning()).toBe(false);
    });

    it('aborts previous work when new work starts', async () => {
        const abortableWork = new LatestAbortableWork();
        const firstWork = deferred<string>();
        const secondWork = deferred<string>();
        let firstSignal: AbortSignal | undefined;
        let secondSignal: AbortSignal | undefined;

        const firstRun = abortableWork.run((signal) => {
            firstSignal = signal;
            return firstWork.promise;
        });
        const secondRun = abortableWork.run((signal) => {
            secondSignal = signal;
            return secondWork.promise;
        });

        expect(firstSignal?.aborted).toBe(true);
        expect(secondSignal?.aborted).toBe(false);
        expect(abortableWork.isRunning()).toBe(true);

        firstWork.resolve('stale');
        secondWork.resolve('fresh');

        await expect(firstRun).resolves.toBeUndefined();
        await expect(secondRun).resolves.toBe('fresh');
        expect(abortableWork.isRunning()).toBe(false);
    });

    it('suppresses errors from aborted work', async () => {
        const abortableWork = new LatestAbortableWork();
        const pending = deferred<string>();
        const runningWork = abortableWork.run(() => pending.promise);

        abortableWork.abort();
        pending.reject(new Error('aborted work failed later'));

        await expect(runningWork).resolves.toBeUndefined();
    });

    it('rethrows errors from active work', async () => {
        const abortableWork = new LatestAbortableWork();
        const error = new Error('boom');

        await expect(
            abortableWork.run(async () => {
                throw error;
            }),
        ).rejects.toThrow(error);
        expect(abortableWork.isRunning()).toBe(false);
    });
});
