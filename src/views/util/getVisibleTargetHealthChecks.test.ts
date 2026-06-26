import { TargetHealthReport } from '../../services/topoCliSchema';
import { TargetDescription } from '../../util/types';
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

    it('returns target health checks when there are no remote processors', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [],
            totalMemoryKb: 1024,
        };
        const healthWithFixableProcessingDomainDriver: TargetHealthReport = {
            ...health,
            processingDomainDriver: {
                name: 'Processing Domain Driver',
                status: 'error',
                value: 'missing',
                fix: {
                    description: 'Install processing domain driver',
                    command: 'topo install processing-domain-driver',
                },
            },
        };
        const expectedHealthChecks = health.dependencies;

        const result = getVisibleTargetHealthChecks(
            healthWithFixableProcessingDomainDriver,
            targetDescription,
        );

        expect(result).toEqual(expectedHealthChecks);
    });

    it('includes the processing domain driver when remote processors exist', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [{ name: 'imx-rproc' }],
            totalMemoryKb: 1024,
        };
        const expectedHealthChecks = [
            ...health.dependencies,
            health.processingDomainDriver,
        ];

        const result = getVisibleTargetHealthChecks(health, targetDescription);

        expect(result).toEqual(expectedHealthChecks);
    });
});
