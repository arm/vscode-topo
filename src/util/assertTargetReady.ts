import { WrappedError } from '../errors/wrappedError';
import type { TargetHealthCheck } from '../services/topoCliSchema';
import type { Loadable, Loaded } from './loadable';
import { getTargetConnectivityCheck, type TargetHealth } from './healthReport';

export function isTargetConnected(health: TargetHealth): boolean {
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
    health: Loadable<TargetHealth>,
): asserts health is Loaded<TargetHealth> {
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
            const connectivity = getTargetConnectivityCheck(health.data);
            if (isConnectivitySuccessful(connectivity)) {
                return;
            }

            throw new WrappedError(
                'TARGET',
                health.loading
                    ? pendingHealthMessage
                    : getTargetConnectivityFailureMessage(target, connectivity),
            );
        }
    }
}

export function isConnectivitySuccessful(
    connectivity: TargetHealthCheck | undefined,
): connectivity is
    | (TargetHealthCheck & {
          status: Exclude<TargetHealthCheck['status'], 'error'>;
      })
    | undefined {
    return connectivity?.status !== 'error';
}

function getTargetConnectivityFailureMessage(
    target: string,
    connectivity: TargetHealthCheck,
): string {
    const details = connectivity.value ? `: ${connectivity.value}` : '';
    return `Target ${target} connectivity is '${connectivity.status}'${details}.`;
}
