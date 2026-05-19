import { HealthCheckDependency } from '../topoCliSchema';

export const getInstallableDependencyCommand = (
    dependency: HealthCheckDependency,
): string | undefined => {
    const command = dependency.fix?.command?.trim();
    return command || undefined;
};
