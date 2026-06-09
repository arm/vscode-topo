import { TargetHealthCheck } from '../topoCliSchema';
import { TargetDescription } from '../util/types';
import { getVisibleTargetIssues } from './getVisibleTargetIssues';

describe('getVisibleTargetDependencies', () => {
    const health: TargetHealthCheck = {
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
        subsystemDriver: {
            name: 'Subsystem Driver',
            status: 'warning',
            value: 'missing',
        },
    };

    it('returns target dependencies when there are no remote processors', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [],
        };
        const healthWithFixableSubsystemDriver: TargetHealthCheck = {
            ...health,
            subsystemDriver: {
                name: 'Subsystem Driver',
                status: 'error',
                value: 'missing',
                fix: {
                    description: 'Install subsystem driver',
                    command: 'topo install subsystem-driver',
                },
            },
        };
        const expectedDependencies = health.dependencies;

        const result = getVisibleTargetIssues(
            healthWithFixableSubsystemDriver,
            targetDescription,
        );

        expect(result).toEqual(expectedDependencies);
    });

    it('includes the subsystem driver when remote processors exist', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [{ name: 'imx-rproc' }],
        };
        const expectedDependencies = [
            ...health.dependencies,
            health.subsystemDriver,
        ];

        const result = getVisibleTargetIssues(health, targetDescription);

        expect(result).toEqual(expectedDependencies);
    });
});
