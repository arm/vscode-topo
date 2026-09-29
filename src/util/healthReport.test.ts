import { getHealthChecks } from './healthReport';
import type { HealthReport } from '../services/topoCliSchema';

const hostCheck = {
    name: 'Docker daemon',
    location: 'host' as const,
    status: 'error' as const,
    value: 'Docker is not running',
    fix: { description: 'Start Docker', command: 'start-docker' },
};
const targetCheck = {
    ...hostCheck,
    location: 'target' as const,
    status: 'undetermined' as const,
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
