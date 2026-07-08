import { TargetModel } from '../models/targetModel';
import type { TargetHealthReport } from '../services/topoCliSchema';
import { getHealthyTarget } from './getHealthyTarget';
import { loaded, unloaded } from './loadable';

describe('getHealthyTarget', () => {
    const target = 'topo.local';
    const targetHealth: TargetHealthReport = {
        destination: `ssh://${target}`,
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'connected',
        },
        processingDomainDriver: {
            name: 'Processing Domain Driver',
            status: 'ok',
            value: 'ready',
        },
        dependencies: [],
    };
    let targetModel: TargetModel;

    beforeEach(() => {
        targetModel = new TargetModel();
        targetModel.setSelected(target);
    });

    it('returns the selected target when health is not blocking', () => {
        expect(getHealthyTarget(targetModel)).toBe(target);
    });

    it('throws a target error when no target is selected', () => {
        targetModel.setSelected(undefined);

        expect(() => getHealthyTarget(targetModel)).toThrow(
            'No target selected. Please select a target.',
        );
    });

    it('throws a target error when target health is loading', () => {
        targetModel.setSelectedTargetHealth(unloaded(true));

        expect(() => getHealthyTarget(targetModel)).toThrow(
            'Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
    });

    it('throws a target error when target connectivity is unhealthy', () => {
        targetModel.setSelectedTargetHealth(
            loaded({
                ...targetHealth,
                connectivity: {
                    ...targetHealth.connectivity,
                    status: 'error',
                    value: 'unreachable',
                },
            }),
        );

        expect(() => getHealthyTarget(targetModel)).toThrow(
            "Target topo.local connectivity is 'error': unreachable.",
        );
    });

    it('omits empty details from target connectivity failure messages', () => {
        targetModel.setSelectedTargetHealth(
            loaded({
                ...targetHealth,
                connectivity: {
                    ...targetHealth.connectivity,
                    status: 'error',
                    value: '',
                },
            }),
        );

        expect(() => getHealthyTarget(targetModel)).toThrow(
            "Target topo.local connectivity is 'error'.",
        );
    });
});
