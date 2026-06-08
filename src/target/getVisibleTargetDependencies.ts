import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { TargetDescription } from '../util/types';

export function getVisibleTargetDependencies(
    health: TargetHealthCheck,
    targetDescription: TargetDescription | undefined,
): IssueCheck[] {
    const dependencies = [...health.dependencies];
    if (targetDescription?.remoteProcessors.length) {
        dependencies.push(health.subsystemDriver);
    }

    return dependencies;
}
