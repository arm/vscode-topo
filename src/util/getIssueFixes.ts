import {
    type HealthCheckFix,
    type TargetHealthCheckResult,
} from '../topoCliSchema';

export type IssueFixCommandGroup = {
    issueNames: string[];
    command: string;
};

export type HealthCheckIssue =
    | TargetHealthCheckResult['connectivity']
    | TargetHealthCheckResult['subsystemDriver']
    | TargetHealthCheckResult['dependencies'][number];

export type FixableHealthCheckIssue = HealthCheckIssue & {
    fix: HealthCheckFix & { command: string };
};

export function hasFixableIssueFix(
    issue: HealthCheckIssue | undefined,
): issue is FixableHealthCheckIssue {
    return !!issue?.fix?.command;
}

export function getTargetIssueFixCommandGroups(
    health: TargetHealthCheckResult | undefined,
): IssueFixCommandGroup[] {
    if (!health) {
        return [];
    }

    const groups = new Map<string, IssueFixCommandGroup>();

    for (const issue of getTargetIssues(health)) {
        const command = issue.fix?.command;
        if (!command) {
            continue;
        }

        const group = groups.get(command);
        if (group) {
            group.issueNames.push(issue.name);
            continue;
        }

        groups.set(command, {
            issueNames: [issue.name],
            command,
        });
    }

    return [...groups.values()];
}

function getTargetIssues(health: TargetHealthCheckResult): HealthCheckIssue[] {
    return [
        health.connectivity,
        health.subsystemDriver,
        ...health.dependencies,
    ];
}
