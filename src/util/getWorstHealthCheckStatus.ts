import { HealthCheck, HealthCheckStatus } from '../services/topoCliSchema';

const statusSeverity: Record<HealthCheckStatus, number> = {
    ok: 0,
    info: 0,
    warning: 1,
    undetermined: 2,
    error: 3,
};

export const getWorstHealthCheckStatus = (
    healthChecks: readonly HealthCheck[],
): HealthCheckStatus => {
    let worstStatus: HealthCheckStatus = 'ok';
    for (const { status } of healthChecks) {
        if (statusSeverity[status] > statusSeverity[worstStatus]) {
            worstStatus = status;
        }
    }
    return worstStatus;
};
