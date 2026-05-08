import { HealthCheckDependency } from '../topoCliSchema';

const fixCommandRegex = /^run `topo install ([A-z-]+)`$/;

export const getInstallableDependency = (
    dependency: HealthCheckDependency,
): string | undefined => {
    if (typeof dependency.fix !== 'string') {
        return undefined;
    }

    const match = dependency.fix.match(fixCommandRegex);
    return match ? match[1] : undefined;
};
