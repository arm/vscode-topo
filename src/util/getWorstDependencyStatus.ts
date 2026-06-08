import { IssueCheck, HealthCheckStatus } from '../topoCliSchema';

export const getWorstDependencyStatus = (
    dependencies: IssueCheck[],
): HealthCheckStatus => {
    return dependencies.reduce((acc: HealthCheckStatus, dependency) => {
        if (dependency.status === 'error') {
            return 'error';
        }
        if (dependency.status === 'warning' && acc !== 'error') {
            return 'warning';
        }
        return acc;
    }, 'ok');
};
