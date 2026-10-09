import { WrappedError } from '../errors/wrappedError';
import type { TargetHealthCheck } from '../services/topoCliSchema';
import type { Loadable, Loaded } from './loadable';
import { getTargetConnectivityCheck } from './healthReport';

export function isTargetConnected(
    health: readonly TargetHealthCheck[],
): boolean {
    return getTargetConnectivityFailure(health) === undefined;
}

export function getTargetConnectivityFailure(
    health: readonly TargetHealthCheck[],
): TargetHealthCheck | undefined {
    const connectivity = getTargetConnectivityCheck(health);
    const isTargetLocal = connectivity === undefined;

    if (isTargetLocal) {
        return undefined;
    }

    return connectivity.status === 'error' ? connectivity : undefined;
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
    health: Loadable<TargetHealthCheck[]>,
): asserts health is Loaded<TargetHealthCheck[]> {
    const pendingHealthMessage = `Target ${target} health is still being checked. Wait for target health checks to finish.`;

    switch (health.status) {
        case 'unloaded':
        case 'errored':
            throw new WrappedError(
                'TARGET',
                health.loading
                    ? pendingHealthMessage
                    : `Target ${target} health is unavailable. Refresh target health and try again.`,
            );
        case 'loaded': {
            const connectivityFailure = getTargetConnectivityFailure(
                health.data,
            );
            if (!connectivityFailure) {
                return;
            }

            throw new WrappedError(
                'TARGET',
                health.loading
                    ? pendingHealthMessage
                    : getTargetConnectivityFailureMessage(
                          target,
                          connectivityFailure,
                      ),
            );
        }
    }
}

function getTargetConnectivityFailureMessage(
    target: string,
    connectivity: TargetHealthCheck,
): string {
    const details = connectivity.value ? `: ${connectivity.value}` : '';
    return `Target ${target} connectivity is '${connectivity.status}'${details}.`;
}
