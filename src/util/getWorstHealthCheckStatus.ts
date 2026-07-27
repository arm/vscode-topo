import { HealthCheck, HealthCheckStatus } from '../services/topoCliSchema';
import { DeepReadonly } from './types';

export const getWorstHealthCheckStatus = (
    healthChecks: DeepReadonly<HealthCheck[]>,
): HealthCheckStatus => {
    return healthChecks.reduce((acc: HealthCheckStatus, healthCheck) => {
        if (healthCheck.status === 'error') {
            return 'error';
        }
        if (healthCheck.status === 'warning' && acc !== 'error') {
            return 'warning';
        }
        return acc;
    }, 'ok');
};
