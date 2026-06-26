import {
    HealthCheck,
    type HealthCheckFix,
    type TargetHealthReport,
} from '../services/topoCliSchema';

export type IssueFixCommandGroup = {
    issueNames: string[];
    command: string;
};

export type FixableIssue = HealthCheck & {
    fix: HealthCheckFix & { command: string };
};

export function hasFixCommand(
    healthCheck: HealthCheck | undefined,
): healthCheck is FixableIssue {
    return !!healthCheck?.fix?.command;
}

export function getTargetIssueFixCommandGroups(
    health: TargetHealthReport | undefined,
): IssueFixCommandGroup[] {
    if (!health) {
        return [];
    }

    return getIssueFixCommandGroups(getTargetHealthChecks(health));
}

export function getIssueFixCommandGroups(
    healthChecks: HealthCheck[],
): IssueFixCommandGroup[] {
    const groups = new Map<string, IssueFixCommandGroup>();

    for (const healthCheck of healthChecks) {
        const command = healthCheck.fix?.command;
        if (!command) {
            continue;
        }

        const group = groups.get(command);
        if (group) {
            group.issueNames.push(healthCheck.name);
            continue;
        }

        groups.set(command, {
            issueNames: [healthCheck.name],
            command,
        });
    }

    return [...groups.values()];
}

function getTargetHealthChecks(health: TargetHealthReport): HealthCheck[] {
    return [
        health.connectivity,
        health.processingDomainDriver,
        ...health.dependencies,
    ];
}
