import {
    HealthCheckDependency,
    TargetHealthCheckResult,
} from '../topoCliSchema';
import { TargetDescription } from '../util/types';

export function getVisibleTargetDependencies(
    health: TargetHealthCheckResult,
    targetDescription: TargetDescription | undefined,
): HealthCheckDependency[] {
    const dependencies = [...health.dependencies];
    if (targetDescription?.remoteProcessors.length) {
        dependencies.push(health.subsystemDriver);
    }

    return dependencies;
}
