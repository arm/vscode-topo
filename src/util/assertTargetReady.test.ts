import type { TargetHealthCheck } from '../services/topoCliSchema';
import {
    assertTargetConnected,
    assertTargetSelected,
    getTargetConnectivityFailure,
    isTargetConnected,
} from './assertTargetReady';
import { errored, loaded, loading, unloaded } from './loadable';

describe('isTargetConnected', () => {
    it('treats local targets without a connectivity check as connected', () => {
        expect(isTargetConnected([])).toBe(true);
    });
});

describe('getTargetConnectivityFailure', () => {
    it.each<{ status: TargetHealthCheck['status']; failed: boolean }>([
        { status: 'ok', failed: false },
        { status: 'warning', failed: false },
        { status: 'info', failed: false },
        { status: 'undetermined', failed: false },
        { status: 'error', failed: true },
    ])(
        'reports failure=$failed for $status connectivity, ignoring dependency errors',
        ({ status, failed }) => {
            const dependencyFailure: TargetHealthCheck = {
                name: 'Container Engine',
                location: 'target',
                status: 'error',
                value: 'unavailable',
            };
            const connectivity: TargetHealthCheck = {
                name: 'Connectivity',
                location: 'target',
                status,
                value: 'connection details',
                fix: {
                    description: 'Set up SSH keys',
                    command: 'topo setup-keys',
                },
            };

            expect(
                getTargetConnectivityFailure([dependencyFailure, connectivity]),
            ).toEqual(failed ? connectivity : undefined);
        },
    );
});

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
    const targetHealth: TargetHealthCheck[] = [
        {
            name: 'Connectivity',
            location: 'target',
            status: 'ok',
            value: 'connected',
        },
    ];

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

    it.each([unloaded(true), loading(errored('health check failed'))])(
        'waits for a health report while $status health is loading',
        (health) => {
            expect(() => assertTargetConnected(target, health)).toThrow(
                'Target topo.local health is still being checked. Wait for target health checks to finish.',
            );
        },
    );

    it.each([unloaded(), errored('health check failed')])(
        'reports unavailable health when the report is $status and no check is running',
        (health) => {
            expect(() => assertTargetConnected(target, health)).toThrow(
                'Target topo.local health is unavailable. Refresh target health and try again.',
            );
        },
    );

    it('accepts an empty loaded target health report', () => {
        expect(() =>
            assertTargetConnected(target, loaded<TargetHealthCheck[]>([])),
        ).not.toThrow();
    });

    it('throws a target error when target connectivity is unhealthy', () => {
        const health = loaded<TargetHealthCheck[]>([
            {
                name: 'Connectivity',
                location: 'target',
                status: 'error',
                value: 'unreachable',
            },
        ]);

        expect(() => assertTargetConnected(target, health)).toThrow(
            "Target topo.local connectivity is 'error': unreachable.",
        );
    });

    it('waits for refreshing target health when the previous value was unhealthy', () => {
        const health = loading(
            loaded<TargetHealthCheck[]>([
                {
                    name: 'Connectivity',
                    location: 'target',
                    status: 'error',
                    value: 'unreachable',
                },
            ]),
        );

        expect(() => assertTargetConnected(target, health)).toThrow(
            'Target topo.local health is still being checked. Wait for target health checks to finish.',
        );
    });

    it('omits empty details from target connectivity failure messages', () => {
        const health = loaded<TargetHealthCheck[]>([
            {
                name: 'Connectivity',
                location: 'target',
                status: 'error',
                value: '',
            },
        ]);

        expect(() => assertTargetConnected(target, health)).toThrow(
            "Target topo.local connectivity is 'error'.",
        );
    });
});
