import { getWorstDependencyStatus } from './getWorstDependencyStatus';

describe('getWorstDependencyStatus', () => {
    it('returns ok when there are no dependencies', () => {
        expect(getWorstDependencyStatus([])).toBe('ok');
    });

    it('returns ok when all dependencies are healthy', () => {
        expect(
            getWorstDependencyStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                { name: 'Subsystem Driver', status: 'ok', value: 'loaded' },
            ]),
        ).toBe('ok');
    });

    it('returns warning if at least one dependency has a warning', () => {
        expect(
            getWorstDependencyStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                { name: 'Something Else', status: 'warning', value: 'foobar' },
            ]),
        ).toBe('warning');
    });

    it('returns error if at least one dependency has an error', () => {
        expect(
            getWorstDependencyStatus([
                { name: 'Container Engine', status: 'ok', value: 'docker' },
                { name: 'Something Else', status: 'warning', value: 'foobar' },
                {
                    name: 'Subsystem Driver',
                    status: 'error',
                    value: 'missing',
                },
            ]),
        ).toBe('error');
    });
});
