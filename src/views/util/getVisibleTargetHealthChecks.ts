import { HealthCheck, TargetHealthReport } from '../../services/topoCliSchema';
import { TargetDescription } from '../../util/types';

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
