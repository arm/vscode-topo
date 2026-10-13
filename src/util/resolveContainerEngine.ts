import { WrappedError } from '../errors/wrappedError';

const CONTAINER_ENGINES = ['docker', 'podman'] as const;
type ContainerEngine = (typeof CONTAINER_ENGINES)[number];

export const resolveContainerEngine = (
    environmentContainerEngine?: string,
): ContainerEngine => {
    const value = environmentContainerEngine?.trim() || 'docker';
    const engine = CONTAINER_ENGINES.find((engine) => engine === value);
    if (engine) {
        return engine;
    }
    throw new WrappedError(
        'ENGINE',
        `Invalid TOPO_ENGINE value "${value}": expected docker or podman`,
    );
};
