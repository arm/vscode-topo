import { WrappedError } from '../errors/wrappedError';
import { TargetModel } from '../models/targetModel';
import type { TargetHealthReport } from '../services/topoCliSchema';

export function getHealthyTarget(targetModel: TargetModel): string {
    const target = targetModel.selected;
    if (!target) {
        throw new WrappedError(
            'TARGET',
            `No target selected. Please select a target.`,
        );
    }

    const health = targetModel.selectedTargetHealth;
    if (health.loading) {
        throw new WrappedError(
            'TARGET',
            `Target ${target} health is still being checked. Wait for target health checks to finish.`,
        );
    }

    if (
        health.status === 'loaded' &&
        health.data.connectivity.status !== 'ok'
    ) {
        throw new WrappedError(
            'TARGET',
            getTargetConnectivityFailureMessage(target, health.data),
        );
    }

    return target;
}

function getTargetConnectivityFailureMessage(
    target: string,
    health: TargetHealthReport,
): string {
    const details = health.connectivity.value
        ? `: ${health.connectivity.value}`
        : '';
    return `Target ${target} connectivity is '${health.connectivity.status}'${details}.`;
}
