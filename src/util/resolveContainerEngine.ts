import {
    CONTAINER_ENGINES,
    type ContainerEngine,
    type ContainerEngineSetting,
} from '../manifest';
import { WrappedError } from '../errors/wrappedError';

export const resolveContainerEngine = (
    settingsContainerEngine: ContainerEngineSetting,
    environmentContainerEngine?: string,
): ContainerEngine => {
    const value =
        settingsContainerEngine === 'auto'
            ? environmentContainerEngine?.trim() || 'docker'
            : settingsContainerEngine;
    const engine = CONTAINER_ENGINES.find((engine) => engine === value);
    if (engine) {
        return engine;
    }
    throw new WrappedError(
        'ENGINE',
        `Invalid container engine "${value}": expected ${CONTAINER_ENGINES.join(' or ')}`,
    );
};
