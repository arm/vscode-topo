import type { TargetHealth } from '../models/health';
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
    const connectedTargetHealth: TargetHealth = {
        capabilities: [
            {
                name: 'Deployment',
                checks: [
                    {
                        name: 'Connectivity',
                        location: 'target',
                        status: 'ok',
                        value: 'connected',
                    },
                ],
            },
        ],
    };
    const disconnectedTargetHealth: TargetHealth = {
        capabilities: [
            {
                name: 'Deployment',
                checks: [
                    {
                        name: 'Connectivity',
                        location: 'target',
                        status: 'error',
                        value: 'unreachable',
                    },
                ],
            },
        ],
    };

    it('accepts loaded target health with working connectivity', () => {
        expect(() =>
            assertTargetConnected(target, loaded(connectedTargetHealth)),
        ).not.toThrow();
    });

    it('accepts previously healthy target health while it is refreshing', () => {
        expect(() =>
            assertTargetConnected(
                target,
                loading(loaded(connectedTargetHealth)),
            ),
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

    it('accepts an empty loaded target health report', () => {
        expect(() =>
            assertTargetConnected(target, loaded({ capabilities: [] })),
        ).not.toThrow();
    });

    it('throws a target error when target connectivity is unhealthy', () => {
        const health = loaded(disconnectedTargetHealth);

        expect(() => assertTargetConnected(target, health)).toThrow(
            "Target topo.local connectivity is 'error': unreachable.",
        );
    });

    it('waits for refreshing target health when the previous value was unhealthy', () => {
        const health = loading(loaded(disconnectedTargetHealth));

        expect(() => assertTargetConnected(target, health)).toThrow(
            'Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
    });

    it('omits empty details from target connectivity failure messages', () => {
        const health = loaded<TargetHealth>({
            capabilities: [
                {
                    name: 'Deployment',
                    checks: [
                        {
                            name: 'Connectivity',
                            location: 'target',
                            status: 'error',
                            value: '',
                        },
                    ],
                },
            ],
        });

        expect(() => assertTargetConnected(target, health)).toThrow(
            "Target topo.local connectivity is 'error'.",
        );
    });
});
