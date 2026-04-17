import * as vscode from 'vscode';
import { showAndLogError } from './showAndLogError';
import { logger } from './logger';
import { TopoError } from '../errors/topoError';

jest.mock('./logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('showAndLogError', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows error message and logs error for plain errors', () => {
        const error = new Error('something broke');

        showAndLogError('Operation failed', error);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Operation failed. something broke',
        );
        expect(logger.error).toHaveBeenCalledWith('Operation failed', error);
        expect(logger.info).not.toHaveBeenCalled();
    });

    it('logs each TopoError entry at its matching log level', () => {
        const logEntries = [
            { time: '2026-04-16T15:00:00Z', level: 'INFO', msg: 'starting' },
            {
                time: '2026-04-16T15:00:01Z',
                level: 'ERROR',
                msg: 'lscpu not found',
            },
            {
                time: '2026-04-16T15:00:02Z',
                level: 'WARN',
                msg: 'retrying',
            },
            {
                time: '2026-04-16T15:00:03Z',
                level: 'DEBUG',
                msg: 'trace info',
            },
        ];
        const error = new TopoError('CLI', 'lscpu not found', { logEntries });

        showAndLogError('Failed to list templates', error);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to list templates. lscpu not found',
        );
        expect(logger.info).toHaveBeenCalledWith('[topo] starting');
        expect(logger.error).toHaveBeenCalledWith('[topo] lscpu not found');
        expect(logger.warn).toHaveBeenCalledWith('[topo] retrying');
        expect(logger.debug).toHaveBeenCalledWith('[topo] trace info');
    });

    it('falls back to logger.error when TopoError has no log entries', () => {
        const error = new TopoError('CLI', 'empty');

        showAndLogError('Failed', error);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed. empty',
        );
        expect(logger.error).toHaveBeenCalledWith('Failed', error);
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.debug).not.toHaveBeenCalled();
    });

    it('logs unknown levels as info', () => {
        const logEntries = [
            {
                time: '2026-04-16T15:00:00Z',
                level: 'TRACE',
                msg: 'trace message',
            },
        ];
        const error = new TopoError('CLI', 'trace message', { logEntries });

        showAndLogError('Failed', error);

        expect(logger.info).toHaveBeenCalledWith('[topo] trace message');
    });

    it('handles non-Error values', () => {
        showAndLogError('Something happened', 'string error');

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Something happened. string error',
        );
        expect(logger.error).toHaveBeenCalledWith(
            'Something happened',
            'string error',
        );
    });
});
