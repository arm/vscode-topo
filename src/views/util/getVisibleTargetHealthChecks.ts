import { HealthCheck, TargetHealthReport } from '../../services/topoCliSchema';

export function getVisibleTargetHealthChecks(
    health: TargetHealthReport,
): readonly HealthCheck[] {
    return [...health.dependencies, health.processingDomainDriver];
}
