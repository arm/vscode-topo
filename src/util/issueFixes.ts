import {
    HealthCheck,
    type HealthCheckFix,
    type TargetHealthReport,
} from '../services/topoCliSchema';

export type IssueFixCommandGroup = {
    readonly issueNames: readonly string[];
    readonly command: string;
};

export type FixableIssue = HealthCheck & {
    readonly fix: HealthCheckFix & { readonly command: string };
};

export function hasFixCommand(
    healthCheck: HealthCheck | undefined,
): healthCheck is FixableIssue {
    return !!healthCheck?.fix?.command;
}

export function getTargetIssueFixCommandGroups(
    health: TargetHealthReport | undefined,
): readonly IssueFixCommandGroup[] {
    if (!health) {
        return [];
    }

    return getIssueFixCommandGroups(getTargetHealthChecks(health));
}

export function getIssueFixCommandGroups(
    healthChecks: readonly HealthCheck[],
): readonly IssueFixCommandGroup[] {
    const issueNamesByCommand = new Map<string, string[]>();

    for (const healthCheck of healthChecks) {
        const command = healthCheck.fix?.command;
        if (!command) {
            continue;
        }

        const issueNames = issueNamesByCommand.get(command);
        if (issueNames) {
            issueNames.push(healthCheck.name);
            continue;
        }

        issueNamesByCommand.set(command, [healthCheck.name]);
    }

    return [...issueNamesByCommand].map(([command, issueNames]) => ({
        issueNames,
        command,
    }));
}

function getTargetHealthChecks(
    health: TargetHealthReport,
): readonly HealthCheck[] {
    return [
        health.connectivity,
        health.processingDomainDriver,
        ...health.dependencies,
    ];
}
