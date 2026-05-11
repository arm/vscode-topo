import * as vscode from 'vscode';
import { showAndLogError } from './showAndLogError';
import { logger } from './logger';
import { WrappedError } from '../errors/wrappedError';

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

    it('logs each WrappedError entry at its matching log level', () => {
        const logEntries = [
            {
                level: 'Info',
                msg: 'Pulling image docker.io/library/nginx:latest',
            },
            { level: 'Error', msg: 'Error: No such container: abc123' },
            {
                level: 'Warning',
                msg: 'Warning: bridge-nf-call-iptables is disabled',
            },
            {
                level: 'Debug',
                msg: 'loading plugin "io.containerd.grpc.v1.cri"',
            },
        ] as const;
        const error = new WrappedError(
            'DOCKER',
            'Error: No such container: abc123',
            [...logEntries],
        );

        showAndLogError('Failed to start container', error);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to start container. Error: No such container: abc123',
        );
        expect(logger.error).toHaveBeenNthCalledWith(
            1,
            'Failed to start container',
        );
        expect(logger.error).toHaveBeenNthCalledWith(
            2,
            'Error: No such container: abc123',
        );
        expect(logger.info).toHaveBeenCalledWith(
            'Pulling image docker.io/library/nginx:latest',
        );
        expect(logger.error).toHaveBeenCalledWith(
            'Error: No such container: abc123',
        );
        expect(logger.warn).toHaveBeenCalledWith(
            'Warning: bridge-nf-call-iptables is disabled',
        );
        expect(logger.debug).toHaveBeenCalledWith(
            'loading plugin "io.containerd.grpc.v1.cri"',
        );
    });

    it('logs WrappedError message even when it has no log entries', () => {
        const error = new WrappedError('DOCKER', 'empty');

        showAndLogError('Failed', error);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed. empty',
        );
        expect(logger.error).toHaveBeenNthCalledWith(1, 'Failed');
        expect(logger.error).toHaveBeenNthCalledWith(2, 'empty');
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.debug).not.toHaveBeenCalled();
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
