import { IssueCheck, HealthCheckStatus } from '../topoCliSchema';

export const getWorstIssueCheckStatus = (
    issueChecks: IssueCheck[],
): HealthCheckStatus => {
    return issueChecks.reduce((acc: HealthCheckStatus, issueCheck) => {
        if (issueCheck.status === 'error') {
            return 'error';
        }
        if (issueCheck.status === 'warning' && acc !== 'error') {
            return 'warning';
        }
        return acc;
    }, 'ok');
};
