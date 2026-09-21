import { WrappedError } from '../errors/wrappedError';
import type {
    ConnectedTargetHealthReport,
    HealthCheck,
    TargetHealthReport,
} from '../services/topoCliSchema';
import type { Loadable, Loaded } from './loadable';

export function isTargetConnected(
    health: TargetHealthReport,
): health is ConnectedTargetHealthReport {
    return health.isLocalhost || health.connectivity.status === 'ok';
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
    health: Loadable<TargetHealthReport>,
): asserts health is Loaded<ConnectedTargetHealthReport> {
    if (health.status === 'loaded') {
        const report = health.data;
        if (isTargetConnected(report)) {
            return;
        }
        if (!health.loading) {
            throw new WrappedError(
                'TARGET',
                getTargetConnectivityFailureMessage(
                    target,
                    report.connectivity,
                ),
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

function getTargetConnectivityFailureMessage(
    target: string,
    connectivity: HealthCheck,
): string {
    const details = connectivity.value ? `: ${connectivity.value}` : '';
    return `Target ${target} connectivity is '${connectivity.status}'${details}.`;
}
