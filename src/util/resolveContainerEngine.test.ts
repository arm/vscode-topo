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

    it('rejects an invalid engine with a CONTAINER_ENGINE error', () => {
        expect(() => resolveContainerEngine('auto', 'invalid')).toThrow(
            expect.objectContaining({
                name: 'WrappedError',
                code: 'CONTAINER_ENGINE',
                message:
                    'Invalid TOPO_ENGINE value "invalid": expected docker or podman',
            }),
        );
    });
});
