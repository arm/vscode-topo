import { TargetState } from './types';

export function hasContainerEngine(targetState: TargetState): boolean {
    if (!targetState.health) {
        return false;
    }

    return targetState.health.dependencies.some(
        (v) => v.name === 'Container Engine' && v.healthy,
    );
}

export function isTargetReachable(targetState: TargetState): boolean {
    return targetState.health?.connectivity.healthy ?? false;
}

export function isTargetReady(targetState: TargetState): boolean {
    return isTargetReachable(targetState) && hasContainerEngine(targetState);
}
