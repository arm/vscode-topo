import { WrappedError } from '../errors/wrappedError';
import type {
    ConnectedTargetHealthReport,
    HealthCheck,
    TargetHealthReport,
} from '../services/topoCliSchema';
import type { Loadable } from './loadable';
import { type Result, success } from './result';

export function isTargetConnected(
    health: TargetHealthReport,
): health is ConnectedTargetHealthReport {
    return health.isLocalhost || health.connectivity.status === 'ok';
}

export function validateTargetSelected(
    selected: string | undefined,
): Result<string> {
    if (!selected) {
        return new WrappedError(
            'TARGET',
            'No target selected. Please select a target.',
        );
    }
    return success(selected);
}

export function validateTargetConnected(
    target: string,
    health: Loadable<TargetHealthReport>,
): Result<void> {
    const report = health.status === 'loaded' ? health.data : undefined;
    if (report && isTargetConnected(report)) {
        return success();
    }

    if (health.loading) {
        return new WrappedError(
            'TARGET',
            `Target ${target} health is still being checked. Wait for target health checks to finish.`,
        );
    }

    if (!report) {
        return new WrappedError(
            'TARGET',
            `Target ${target} health is unavailable. Refresh target health and try again.`,
        );
    }

    return new WrappedError(
        'TARGET',
        getTargetConnectivityFailureMessage(target, report.connectivity),
    );
}

function getTargetConnectivityFailureMessage(
    target: string,
    connectivity: HealthCheck,
): string {
    const details = connectivity.value ? `: ${connectivity.value}` : '';
    return `Target ${target} connectivity is '${connectivity.status}'${details}.`;
}
