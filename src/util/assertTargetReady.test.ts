import type { TargetHealthReport } from '../services/topoCliSchema';
import {
    assertTargetConnected,
    assertTargetSelected,
} from './assertTargetReady';
import { errored, loaded, loading, unloaded } from './loadable';

describe('assertTargetSelected', () => {
    it('accepts a selected target', () => {
        expect(() => assertTargetSelected('topo.local')).not.toThrow();
    });

    it('throws a target error when no target is selected', () => {
        expect(() => assertTargetSelected(undefined)).toThrow(
            'No target selected. Please select a target.',
        );
    });
});

describe('assertTargetConnected', () => {
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

    it('accepts loaded target health with working connectivity', () => {
        expect(() =>
            assertTargetConnected(target, loaded(targetHealth)),
        ).not.toThrow();
    });

    it('accepts previously healthy target health while it is refreshing', () => {
        expect(() =>
            assertTargetConnected(target, loading(loaded(targetHealth))),
        ).not.toThrow();
    });

    it('throws a target error when target health is loading', () => {
        expect(() => assertTargetConnected(target, unloaded(true))).toThrow(
            'Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
    });

    it.each([unloaded(), errored('health check failed')])(
        'throws a target error when target health is unavailable',
        (health) => {
            expect(() => assertTargetConnected(target, health)).toThrow(
                'Target topo.local health is unavailable. Refresh target health and try again.',
            );
        },
    );

    it('throws a target error when target connectivity is unhealthy', () => {
        const health = loaded({
            ...targetHealth,
            connectivity: {
                ...targetHealth.connectivity,
                status: 'error' as const,
                value: 'unreachable',
            },
        });

        expect(() => assertTargetConnected(target, health)).toThrow(
            "Target topo.local connectivity is 'error': unreachable.",
        );
    });

    it('waits for refreshing target health when the previous value was unhealthy', () => {
        const health = loading(
            loaded({
                ...targetHealth,
                connectivity: {
                    ...targetHealth.connectivity,
                    status: 'error' as const,
                    value: 'unreachable',
                },
            }),
        );

        expect(() => assertTargetConnected(target, health)).toThrow(
            'Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
    });

    it('omits empty details from target connectivity failure messages', () => {
        const health = loaded({
            ...targetHealth,
            connectivity: {
                ...targetHealth.connectivity,
                status: 'error' as const,
                value: '',
            },
        });

        expect(() => assertTargetConnected(target, health)).toThrow(
            "Target topo.local connectivity is 'error'.",
        );
    });
});
