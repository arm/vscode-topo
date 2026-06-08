import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { TargetDescription } from '../util/types';

export function getVisibleTargetIssues(
    health: TargetHealthCheck,
    targetDescription: TargetDescription | undefined,
): IssueCheck[] {
    const issues = [...health.dependencies];
    if (targetDescription?.remoteProcessors.length) {
        issues.push(health.subsystemDriver);
    }

    return issues;
}
