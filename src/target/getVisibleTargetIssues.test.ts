import { TargetHealthCheck } from '../topoCliSchema';
import { TargetDescription } from '../util/types';
import { getVisibleTargetIssues } from './getVisibleTargetIssues';

describe('getVisibleTargetDependencies', () => {
    const health: TargetHealthCheck = {
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

    it('returns target dependencies when there are no remote processors', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [],
            totalMemoryKb: 1024,
        };
        const healthWithFixableProcessingDomainDriver: TargetHealthCheck = {
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
        const expectedDependencies = health.dependencies;

        const result = getVisibleTargetIssues(
            healthWithFixableProcessingDomainDriver,
            targetDescription,
        );

        expect(result).toEqual(expectedDependencies);
    });

    it('includes the processing domain driver when remote processors exist', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [{ name: 'imx-rproc' }],
            totalMemoryKb: 1024,
        };
        const expectedDependencies = [
            ...health.dependencies,
            health.processingDomainDriver,
        ];

        const result = getVisibleTargetIssues(health, targetDescription);

        expect(result).toEqual(expectedDependencies);
    });
});
