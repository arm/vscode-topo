import type {
    HealthCheck,
    HealthReport,
    HostHealthCheck,
    TargetHealthCheck,
} from '../services/topoCliSchema';

export function filterHealthChecks(
    report: HealthReport,
    location: 'host',
): HostHealthCheck[];
export function filterHealthChecks(
    report: HealthReport,
    location: 'target',
): TargetHealthCheck[];

export function filterHealthChecks(
    report: HealthReport,
    location: HealthCheck['location'],
): HealthCheck[] {
    const checks = new Map<string, HealthCheck>();
    for (const capability of report.capabilities) {
        for (const check of capability.checks) {
            if (check.location === location && !checks.has(check.name)) {
                checks.set(check.name, check);
            }
        }
    }
    return [...checks.values()];
}

export function getTargetConnectivityCheck(
    checks: readonly TargetHealthCheck[],
): TargetHealthCheck | undefined {
    return checks.find((check) => check.name === 'Connectivity');
}
