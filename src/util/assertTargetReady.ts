import { WrappedError } from '../errors/wrappedError';
import type { HealthCheck } from '../services/topoCliSchema';
import type { Loadable, Loaded } from './loadable';
import { getTargetConnectivityCheck } from './healthReport';

export function isTargetConnected(health: readonly HealthCheck[]): boolean {
    return isConnectivitySuccessful(getTargetConnectivityCheck(health));
}

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
    health: Loadable<HealthCheck[]>,
): asserts health is Loaded<HealthCheck[]> {
    if (health.status === 'loaded') {
        const connectivity = getTargetConnectivityCheck(health.data);
        if (isConnectivitySuccessful(connectivity)) {
            return;
        }

        if (!health.loading) {
            throw new WrappedError(
                'TARGET',
                getTargetConnectivityFailureMessage(target, connectivity),
            );
        }
    }

    if (health.loading) {
        throw new WrappedError(
            'TARGET',
            `Target ${target} health is still being checked. Wait for target health checks to finish.`,
        );
    }

    throw new WrappedError(
        'TARGET',
        `Target ${target} health is unavailable. Refresh target health and try again.`,
    );
}

export function isConnectivitySuccessful(
    connectivity: HealthCheck | undefined,
): connectivity is HealthCheck | undefined {
    return connectivity?.status !== 'error';
}

function getTargetConnectivityFailureMessage(
    target: string,
    connectivity: HealthCheck,
): string {
    const details = connectivity.value ? `: ${connectivity.value}` : '';
    return `Target ${target} connectivity is '${connectivity.status}'${details}.`;
}
