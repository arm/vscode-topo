import {
    getHealthChecks,
    getHostHealth,
    getTargetHealth,
} from './healthReport';
import type { HealthCheck, HealthReport } from '../services/topoCliSchema';

const hostCheck: HealthCheck = {
    name: 'Docker daemon',
    location: 'host',
    status: 'error',
    value: 'Docker is not running',
    fix: { description: 'Start Docker', command: 'start-docker' },
};
const targetCheck: HealthCheck = {
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

describe('healthReport', () => {
    it('preserves capability order and shared host checks without target data', () => {
        expect(getHostHealth(report)).toEqual({
            capabilities: [
                { name: 'Deployment', checks: [hostCheck] },
                { name: 'Project management', checks: [hostCheck] },
            ],
        });
    });

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

    it('deduplicates shared checks when flattening scoped health', () => {
        expect(getHealthChecks(getTargetHealth(report))).toEqual([targetCheck]);
    });

    it('returns no checks for an empty report', () => {
        expect(getHealthChecks({ capabilities: [] })).toEqual([]);
    });
});
