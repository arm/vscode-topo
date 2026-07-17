import { WrappedError } from '../errors/wrappedError';
import type { TargetHealthReport } from '../services/topoCliSchema';
import type { Loadable, Loaded } from './loadable';

export type ConnectedTargetHealth = Loaded<
    TargetHealthReport & {
        connectivity: TargetHealthReport['connectivity'] & { status: 'ok' };
    }
>;

export function assertTargetSelected(
    selected: string | undefined,
): asserts selected is string {
    if (!selected) {
        throw new WrappedError(
            'TARGET',
            'No target selected. Please select a target.',
        );
    }
}

export function assertTargetConnected(
    target: string,
    health: Loadable<TargetHealthReport>,
): asserts health is ConnectedTargetHealth {
    if (
        health.status === 'loaded' &&
        health.data.connectivity.status === 'ok'
    ) {
        return;
    }

    if (health.loading) {
        throw new WrappedError(
            'TARGET',
            `Target ${target} health is still being checked. Wait for target health checks to finish.`,
        );
    }

    if (health.status !== 'loaded') {
        throw new WrappedError(
            'TARGET',
            `Target ${target} health is unavailable. Refresh target health and try again.`,
        );
    }

    throw new WrappedError(
        'TARGET',
        getTargetConnectivityFailureMessage(target, health.data),
    );
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
