import { TargetState } from './types';
import { HealthCheckDependency } from '../topoCliSchema';

export function hasContainerEngine(targetState: TargetState): boolean {
    if (!targetState.health) {
        return false;
    }

    return targetState.health.dependencies.some(
        (v: HealthCheckDependency) =>
            v.name === 'Container Engine' && v.status === 'ok',
    );
}

export function isTargetReachable(targetState: TargetState): boolean {
    return targetState.health?.connectivity.status === 'ok';
}

export function isTargetReady(targetState?: TargetState): boolean {
    return (
        !!targetState &&
        isTargetReachable(targetState) &&
        hasContainerEngine(targetState)
    );
}
