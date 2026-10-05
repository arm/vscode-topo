import { getHealthChecks } from './healthReport';
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

describe('getHealthChecks', () => {
    it('shows shared host checks once, preserving diagnostics and fixes', () => {
        expect(getHealthChecks(report, 'host')).toEqual([hostCheck]);
    });

    it('keeps target checks separate from host checks with the same name', () => {
        expect(getHealthChecks(report, 'target')).toEqual([targetCheck]);
    });

    it('returns no checks for an empty report', () => {
        expect(getHealthChecks({ capabilities: [] }, 'host')).toEqual([]);
    });
});
