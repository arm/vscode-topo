import type {
    HealthCheck,
    HealthReport,
    HostHealthCheck,
    TargetHealthCheck,
} from '../services/topoCliSchema';

export type Health<T extends HealthCheck = HealthCheck> = {
    readonly capabilities: readonly {
        readonly name: string;
        readonly checks: readonly T[];
    }[];
};

export type HostHealth = Health<HostHealthCheck>;
export type TargetHealth = Health<TargetHealthCheck>;

function getScopedHealth<T extends HealthCheck>(
    report: HealthReport,
    matches: (check: HealthCheck) => check is T,
): Health<T> {
    return {
        capabilities: report.capabilities.flatMap(({ name, checks }) => {
            const scopedChecks = checks.filter(matches);
            return scopedChecks.length > 0
                ? [{ name, checks: scopedChecks }]
                : [];
        }),
    };
}

export function getHostHealth(report: HealthReport): HostHealth {
    return getScopedHealth(
        report,
        (check): check is HostHealthCheck => check.location === 'host',
    );
}

export function getTargetHealth(report: HealthReport): TargetHealth {
    return getScopedHealth(
        report,
        (check): check is TargetHealthCheck => check.location === 'target',
    );
}

export function getHealthChecks<T extends HealthCheck>(health: Health<T>): T[] {
    const checks = new Map<string, T>();
    for (const capability of health.capabilities) {
        for (const check of capability.checks) {
            if (!checks.has(check.name)) {
                checks.set(check.name, check);
            }
        }
    }
    return [...checks.values()];
}

export function getTargetConnectivityCheck(
    health: TargetHealth,
): TargetHealthCheck | undefined {
    for (const { checks } of health.capabilities) {
        const connectivity = checks.find(
            (check) => check.name === 'Connectivity',
        );
        if (connectivity) {
            return connectivity;
        }
    }
}
