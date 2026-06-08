import {
    IssueCheck,
    type HealthCheckFix,
    type TargetHealthCheck,
} from '../topoCliSchema';

export type IssueFixCommandGroup = {
    issueNames: string[];
    command: string;
};

export type FixableHealthIssue = IssueCheck & {
    fix: HealthCheckFix & { command: string };
};

export function hasFixableIssueFix(
    issue: IssueCheck | undefined,
): issue is FixableHealthIssue {
    return !!issue?.fix?.command;
}

export function getTargetIssueFixCommandGroups(
    health: TargetHealthCheck | undefined,
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

function getTargetIssues(health: TargetHealthCheck): IssueCheck[] {
    return [
        health.connectivity,
        health.subsystemDriver,
        ...health.dependencies,
    ];
}
