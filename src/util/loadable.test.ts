import { errored, loaded, loading } from './loadable';

describe('loadable', () => {
    it('loaded() wraps data in a non-loading loaded state', () => {
        const data = { value: 42 };

        expect(loaded(data)).toStrictEqual({
            status: 'loaded',
            data,
            loading: false,
        });
    });

    it('loading() preserves the current state while marking it as loading', () => {
        const current = loaded('hello');

        expect(loading(current)).toStrictEqual({
            status: 'loaded',
            data: 'hello',
            loading: true,
        });
    });

    it('errored() preserves Error instances in a non-loading errored state', () => {
        const error = new Error('boom');

        expect(errored(error)).toStrictEqual({
            status: 'errored',
            error,
            loading: false,
        });
    });

    it('errored() converts non-Error values to Error instances', () => {
        const result = errored('boom');

        if (result.status !== 'errored') {
            throw new Error('Expected an errored loadable');
        }

        expect(result.loading).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('boom');
    });
});
