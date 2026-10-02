import { getWorstHealthCheckStatus } from './getWorstHealthCheckStatus';

describe('getWorstHealthCheckStatus', () => {
    it('returns ok when there are no healthChecks', () => {
        expect(getWorstHealthCheckStatus([])).toBe('ok');
    });

    it('returns ok when all health checks are healthy', () => {
        expect(
            getWorstHealthCheckStatus([
                {
                    name: 'Container Engine',
                    location: 'target',
                    status: 'ok',
                    value: 'docker',
                },
                {
                    name: 'Processing Domain Driver',
                    location: 'target',
                    status: 'ok',
                    value: 'loaded',
                },
            ]),
        ).toBe('ok');
    });

    it('returns warning if at least one health check has a warning', () => {
        expect(
            getWorstHealthCheckStatus([
                {
                    name: 'Container Engine',
                    location: 'target',
                    status: 'ok',
                    value: 'docker',
                },
                {
                    name: 'Debugger',
                    location: 'target',
                    status: 'warning',
                    value: 'missing',
                },
            ]),
        ).toBe('warning');
    });

    it('returns undetermined when a check is undetermined and none have errors', () => {
        expect(
            getWorstHealthCheckStatus([
                {
                    name: 'Hardware Info',
                    location: 'target',
                    status: 'ok',
                    value: 'lscpu',
                },
                {
                    name: 'Container Engine',
                    location: 'target',
                    status: 'warning',
                    value: 'missing',
                },
                {
                    name: 'Processing Domain Driver',
                    location: 'target',
                    status: 'undetermined',
                    value: 'not checked: prerequisite failed',
                },
            ]),
        ).toBe('undetermined');
    });

    it('returns error if at least one health check has an error', () => {
        expect(
            getWorstHealthCheckStatus([
                {
                    name: 'Hardware Info',
                    location: 'target',
                    status: 'ok',
                    value: 'lscpu',
                },
                {
                    name: 'Debugger',
                    location: 'target',
                    status: 'warning',
                    value: 'missing',
                },
                {
                    name: 'Container Engine',
                    location: 'target',
                    status: 'error',
                    value: 'not running',
                },
                {
                    name: 'Processing Domain Driver',
                    location: 'target',
                    status: 'undetermined',
                    value: 'not checked: prerequisite failed',
                },
            ]),
        ).toBe('error');
    });
});
