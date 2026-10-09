import { filterHealthChecks } from './healthReport';
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

describe('filterHealthChecks', () => {
    it('shows shared host checks once, preserving diagnostics and fixes', () => {
        expect(filterHealthChecks(report, 'host')).toEqual([hostCheck]);
    });

    it('keeps target checks separate from host checks with the same name', () => {
        expect(filterHealthChecks(report, 'target')).toEqual([targetCheck]);
    });

    it('returns no checks for an empty report', () => {
        expect(filterHealthChecks({ capabilities: [] }, 'host')).toEqual([]);
    });
});
