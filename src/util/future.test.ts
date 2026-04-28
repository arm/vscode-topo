import { future } from './future';

describe('future', () => {
    it('get() returns undefined before the promise resolves', () => {
        const f = future(() => new Promise(() => {}));

        expect(f.get()).toBeUndefined();
    });

    it('get() returns the resolved value after the promise resolves', async () => {
        const f = future(() => Promise.resolve(42));

        await f.promise;

        expect(f.get()).toBe(42);
    });

    it('promise resolves to the value returned by the fn', async () => {
        const f = future(() => Promise.resolve('hello'));

        await expect(f.promise).resolves.toBe('hello');
    });
});
