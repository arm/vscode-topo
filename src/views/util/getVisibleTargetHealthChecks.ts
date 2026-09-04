import {
    HealthCheck,
    TargetDescription,
    TargetHealthReport,
} from '../../services/topoCliSchema';

export function getVisibleTargetHealthChecks(
    health: TargetHealthReport,
    targetDescription: TargetDescription | undefined,
): readonly HealthCheck[] {
    const healthChecks = [...health.dependencies];
    if (targetDescription?.remoteProcessors.length) {
        healthChecks.push(health.processingDomainDriver);
    }

    return healthChecks;
}
