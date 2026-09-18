import { TargetHealthReport } from '../../services/topoCliSchema';
import { getVisibleTargetHealthChecks } from './getVisibleTargetHealthChecks';

describe('getVisibleTargetHealthChecks', () => {
    const health: TargetHealthReport = {
        destination: 'ssh://topo.local',
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'connected',
        },
        dependencies: [
            {
                name: 'Container Engine',
                status: 'ok',
                value: 'docker',
            },
        ],
        processingDomainDriver: {
            name: 'Processing Domain Driver',
            status: 'warning',
            value: 'missing',
        },
    };

    it('includes the driver when the target is connected', () => {
        expect(getVisibleTargetHealthChecks(health)).toEqual([
            ...health.dependencies,
            health.processingDomainDriver,
        ]);
    });
});
