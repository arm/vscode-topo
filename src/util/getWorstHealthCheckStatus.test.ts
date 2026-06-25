import { getWorstHealthCheckStatus } from './getWorstHealthCheckStatus';

describe('getWorstHealthCheckStatus', () => {
    it('returns ok when there are no healthChecks', () => {
        expect(getWorstHealthCheckStatus([])).toBe('ok');
    });

    it('returns ok when all health checks are healthy', () => {
        expect(
            getWorstHealthCheckStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                {
                    name: 'Processing Domain Driver',
                    status: 'ok',
                    value: 'loaded',
                },
            ]),
        ).toBe('ok');
    });

    it('returns warning if at least one health check has a warning', () => {
        expect(
            getWorstHealthCheckStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                { name: 'Something Else', status: 'warning', value: 'foobar' },
            ]),
        ).toBe('warning');
    });

    it('returns error if at least one health check has an error', () => {
        expect(
            getWorstHealthCheckStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                { name: 'Something Else', status: 'warning', value: 'foobar' },
                {
                    name: 'Processing Domain Driver',
                    status: 'error',
                    value: 'missing',
                },
            ]),
        ).toBe('error');
    });
});
