import type { TargetHealthReport } from '../services/topoCliSchema';
import {
    validateTargetConnected,
    validateTargetSelected,
} from './validateTargetReady';
import { errored, loaded, loading, unloaded } from './loadable';

describe('validateTargetSelected', () => {
    it('accepts a selected target', () => {
        expect(validateTargetSelected('topo.local')).toMatchObject({
            kind: 'success',
        });
    });

    it('returns a target error when no target is selected', () => {
        expect(validateTargetSelected(undefined)).toEqual(
            expect.objectContaining({
                kind: 'error',
                code: 'TARGET',
                message: 'No target selected. Please select a target.',
            }),
        );
    });
});

describe('validateTargetConnected', () => {
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
        expect(
            validateTargetConnected(target, loaded(targetHealth)),
        ).toMatchObject({ kind: 'success' });
    });

    it('accepts localhost without an SSH connectivity check', () => {
        const health = loaded<TargetHealthReport>({
            destination: 'ssh://localhost',
            isLocalhost: true,
            dependencies: targetHealth.dependencies,
            processingDomainDriver: targetHealth.processingDomainDriver,
        });

        expect(validateTargetConnected('localhost', health)).toMatchObject({
            kind: 'success',
        });
    });

    it('accepts previously healthy target health while it is refreshing', () => {
        expect(
            validateTargetConnected(target, loading(loaded(targetHealth))),
        ).toMatchObject({ kind: 'success' });
    });

    it('returns a target error when target health is loading', () => {
        expect(validateTargetConnected(target, unloaded(true))).toEqual(
            expect.objectContaining({
                kind: 'error',
                code: 'TARGET',
                message:
                    'Target topo.local health is still being checked. Wait for target health checks to finish.',
            }),
        );
    });

    it.each([unloaded(), errored('health check failed')])(
        'returns a target error when target health is unavailable',
        (health) => {
            expect(validateTargetConnected(target, health)).toEqual(
                expect.objectContaining({
                    kind: 'error',
                    code: 'TARGET',
                    message:
                        'Target topo.local health is unavailable. Refresh target health and try again.',
                }),
            );
        },
    );

    it('returns a target error when target connectivity is unhealthy', () => {
        const health = loaded({
            destination: targetHealth.destination,
            isLocalhost: false as const,
            dependencies: [],
            connectivity: {
                ...targetHealth.connectivity,
                status: 'error' as const,
                value: 'unreachable',
            },
        });

        expect(validateTargetConnected(target, health)).toEqual(
            expect.objectContaining({
                kind: 'error',
                code: 'TARGET',
                message:
                    "Target topo.local connectivity is 'error': unreachable.",
            }),
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

        expect(validateTargetConnected(target, health)).toEqual(
            expect.objectContaining({
                kind: 'error',
                code: 'TARGET',
                message:
                    'Target topo.local health is still being checked. Wait for target health checks to finish.',
            }),
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

        expect(validateTargetConnected(target, health)).toEqual(
            expect.objectContaining({
                kind: 'error',
                code: 'TARGET',
                message: "Target topo.local connectivity is 'error'.",
            }),
        );
    });
});
