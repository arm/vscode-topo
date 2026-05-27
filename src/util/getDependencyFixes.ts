import { HealthCheckDependency } from '../topoCliSchema';

export type DependencyFixCommandGroup = {
    names: string[];
    command: string;
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
