import { resolveContainerEngine } from './resolveContainerEngine';

describe('resolveContainerEngine', () => {
    it('uses the environment engine', () => {
        expect(resolveContainerEngine(' podman ')).toBe('podman');
    });

    it('defaults to Docker when the environment value is unset or empty', () => {
        expect(resolveContainerEngine()).toBe('docker');
        expect(resolveContainerEngine(' ')).toBe('docker');
    });

    it('rejects an invalid engine with a CONTAINER_ENGINE error', () => {
        expect(() => resolveContainerEngine('invalid')).toThrow(
            expect.objectContaining({
                name: 'WrappedError',
                code: 'CONTAINER_ENGINE',
                message:
                    'Invalid TOPO_ENGINE value "invalid": expected docker or podman',
            }),
        );
    });
});
