import { TargetHealthCheckResult } from '../topoCliSchema';
import { TargetDescription } from '../util/types';
import { getVisibleTargetDependencies } from './getVisibleTargetDependencies';

describe('getVisibleTargetDependencies', () => {
    const health: TargetHealthCheckResult = {
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

        expect(getVisibleTargetDependencies(health, targetDescription)).toEqual(
            health.dependencies,
        );
    });

    it('includes the subsystem driver when remote processors exist', () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [],
            remoteProcessors: [{ name: 'imx-rproc' }],
        };

        expect(getVisibleTargetDependencies(health, targetDescription)).toEqual(
            [...health.dependencies, health.subsystemDriver],
        );
    });
});
