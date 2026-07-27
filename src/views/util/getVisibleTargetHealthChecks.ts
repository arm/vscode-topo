import { HealthCheck, TargetHealthReport } from '../../services/topoCliSchema';
import { DeepReadonly, TargetDescription } from '../../util/types';

export function getVisibleTargetHealthChecks(
    health: DeepReadonly<TargetHealthReport>,
    targetDescription: DeepReadonly<TargetDescription> | undefined,
): DeepReadonly<HealthCheck>[] {
    const healthChecks = [...health.dependencies];
    if (targetDescription?.remoteProcessors.length) {
        healthChecks.push(health.processingDomainDriver);
    }

    return healthChecks;
}
