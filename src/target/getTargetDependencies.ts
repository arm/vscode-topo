import { ContainersManager } from './containersManager';
import { TargetDescriptionStore } from './targetDescriptionStore';
import { HealthCheckDependency } from '../topoCliSchema';
import { getVisibleTargetDependencies } from './getVisibleTargetDependencies';

export async function getTargetDependencies(
    target: string,
    containersManager: ContainersManager,
    targetDescriptionStore: TargetDescriptionStore,
): Promise<HealthCheckDependency[] | undefined> {
    const targetState = await containersManager.getTargetState(target);
    if (!targetState.health) {
        return;
    }

    const targetDescription =
        await targetDescriptionStore.getDescription(target);
    return getVisibleTargetDependencies(targetState.health, targetDescription);
}
