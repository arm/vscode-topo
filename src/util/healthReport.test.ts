import {
    getHealthChecks,
    getHostHealth,
    getTargetHealth,
} from './healthReport';
import type {
    HealthReport,
    HostHealthCheck,
    TargetHealthCheck,
} from '../services/topoCliSchema';

const hostCheck: HostHealthCheck = {
    name: 'Docker daemon',
    location: 'host',
    status: 'error',
    value: 'Docker is not running',
    fix: { description: 'Start Docker', command: 'start-docker' },
};
const targetCheck: TargetHealthCheck = {
    ...hostCheck,
    location: 'target',
    status: 'undetermined',
};
const report: HealthReport = {
    capabilities: [
        {
            name: 'Deployment',
            status: 'error',
            checks: [hostCheck, targetCheck],
        },
        {
            name: 'Project management',
            status: 'error',
            checks: [hostCheck, targetCheck],
        },
    ],
};

describe('getHostHealth', () => {
    it('preserves capability order and shared host checks without target data', () => {
        expect(getHostHealth(report)).toEqual({
            capabilities: [
                { name: 'Deployment', checks: [hostCheck] },
                { name: 'Project management', checks: [hostCheck] },
            ],
        });
    });
});

describe('getTargetHealth', () => {
    it('preserves target capabilities and omits groups without target checks', () => {
        expect(
            getTargetHealth({
                capabilities: [
                    { name: 'Host only', status: 'error', checks: [hostCheck] },
                    ...report.capabilities,
                    { name: 'Empty', status: 'ok', checks: [] },
                ],
            }),
        ).toEqual({
            capabilities: [
                { name: 'Deployment', checks: [targetCheck] },
                { name: 'Project management', checks: [targetCheck] },
            ],
        });
    });
});

describe('getHealthChecks', () => {
    it('preserves same-name checks and their diagnostics in capability order', () => {
        const healthyCheck: TargetHealthCheck = {
            name: 'Container Engine',
            location: 'target',
            status: 'ok',
            value: 'docker',
        };
        const failingCheck: TargetHealthCheck = {
            name: 'Container Engine',
            location: 'target',
            status: 'error',
            value: 'Docker is not running',
            fix: { description: 'Start Docker', command: 'start-docker' },
        };

        const checks = getHealthChecks({
            capabilities: [
                { name: 'Deployment', checks: [healthyCheck] },
                {
                    name: 'Project management',
                    checks: [failingCheck],
                },
            ],
        });

        expect(checks).toEqual([healthyCheck, failingCheck]);
    });

    it('returns no checks for an empty report', () => {
        expect(getHealthChecks({ capabilities: [] })).toEqual([]);
    });
});
