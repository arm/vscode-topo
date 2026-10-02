import { resolveContainerEngine } from './resolveContainerEngine';

describe('resolveContainerEngine', () => {
    it('prefers the setting over the environment', () => {
        expect(resolveContainerEngine('docker', 'podman')).toBe('docker');
    });

    it('uses the environment in auto mode', () => {
        expect(resolveContainerEngine('auto', ' podman ')).toBe('podman');
    });

    it('defaults auto to Docker when the environment value is unset or empty', () => {
        expect(resolveContainerEngine('auto')).toBe('docker');
        expect(resolveContainerEngine('auto', ' ')).toBe('docker');
    });

    it('rejects an invalid engine with an ENGINE error', () => {
        expect(() => resolveContainerEngine('auto', 'invalid')).toThrow(
            expect.objectContaining({
                name: 'WrappedError',
                code: 'ENGINE',
                message:
                    'Invalid container engine "invalid": expected docker or podman',
            }),
        );
    });
});
