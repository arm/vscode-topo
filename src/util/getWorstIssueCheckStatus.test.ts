import { getWorstIssueCheckStatus } from './getWorstIssueCheckStatus';

describe('getWorstDependencyStatus', () => {
    it('returns ok when there are no dependencies', () => {
        expect(getWorstIssueCheckStatus([])).toBe('ok');
    });

    it('returns ok when all dependencies are healthy', () => {
        expect(
            getWorstIssueCheckStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                {
                    name: 'Processing Domain Driver',
                    status: 'ok',
                    value: 'loaded',
                },
            ]),
        ).toBe('ok');
    });

    it('returns warning if at least one dependency has a warning', () => {
        expect(
            getWorstIssueCheckStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                { name: 'Something Else', status: 'warning', value: 'foobar' },
            ]),
        ).toBe('warning');
    });

    it('returns error if at least one dependency has an error', () => {
        expect(
            getWorstIssueCheckStatus([
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
