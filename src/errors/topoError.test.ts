import { TopoError } from './topoError';

describe('TopoError', () => {
    it('stores code, message, and log entries', () => {
        const entries = [
            {
                time: '2026-04-16T15:14:48Z',
                level: 'ERROR',
                msg: 'something failed',
            },
        ];
        const error = new TopoError('CLI', 'something failed', {
            logEntries: entries,
        });

        expect(error.logEntries).toEqual(entries);
        expect(error.message).toBe('something failed');
        expect(error.code).toBe('CLI');
        expect(error.name).toBe('TopoError');
    });

    it('defaults logEntries to empty array when not provided', () => {
        const error = new TopoError('CLONE', 'clone failed');

        expect(error.logEntries).toEqual([]);
    });

    it('preserves the cause option', () => {
        const cause = new Error('root cause');
        const error = new TopoError('CLI', 'wrapper', { cause });

        expect(error.cause).toBe(cause);
    });
});
