import { HealthCheckDependency, HealthCheckFix } from '../topoCliSchema';

export type DependencyFixCommandGroup = {
    names: string[];
    command: string;
};

export type IssueFix = {
    dependency: HealthCheckDependency;
    fix: HealthCheckFix;
};

export function getDependencyFixCommandGroups(
    dependencies: HealthCheckDependency[],
): DependencyFixCommandGroup[] {
    const groups = new Map<string, DependencyFixCommandGroup>();

    for (const dependency of dependencies) {
        const command = dependency.fix?.command;
        if (!command) {
            continue;
        }

        const group = groups.get(command);
        if (group) {
            group.names.push(dependency.name);
            continue;
        }

        groups.set(command, {
            names: [dependency.name],
            command,
        });
    }

    return [...groups.values()];
}

export function getFixableDependencyFixes(
    dependencies: HealthCheckDependency[],
): IssueFix[] {
    const fixes: IssueFix[] = [];

    for (const dependency of dependencies) {
        const fix = dependency.fix;
        if (!fix?.command) {
            continue;
        }
        fixes.push({ dependency, fix });
    }

    return fixes;
}
