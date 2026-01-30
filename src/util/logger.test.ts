import { OutputChannelLogger, stringifyMessage } from './logger';
import * as vscode from 'vscode';
import { mutable } from './mutable';

jest.mock('vscode');

describe('OutputChannelLogger', () => {
    const appendLineMock = jest.fn();
    const configurationGetMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.window.createOutputChannel as jest.Mock).mockReturnValue({
            appendLine: appendLineMock,
        });
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: configurationGetMock,
        });
    });

    it('does not log when verbosity is off', () => {
        configurationGetMock.mockReturnValue('off');
        const logger = new OutputChannelLogger();

        logger.error('error');
        logger.warn('warn');
        logger.info('info');
        logger.debug('debug');

        expect(appendLineMock).not.toHaveBeenCalled();
    });

    it('uses default verbosity when configuration is missing', () => {
        configurationGetMock.mockReturnValue(undefined);
        const logger = new OutputChannelLogger();

        logger.info('ignored info');
        logger.warn('visible warn');

        expect(appendLineMock).toHaveBeenCalledTimes(1);
        expect(appendLineMock).toHaveBeenCalledWith('visible warn');
    });

    it('logs messages only when within the current verbosity', () => {
        configurationGetMock.mockReturnValue('info');
        const logger = new OutputChannelLogger();

        logger.debug('debug');
        logger.info('info');
        logger.warn('warn');
        logger.error('error');

        expect(appendLineMock).toHaveBeenCalledTimes(3);
        expect(appendLineMock).toHaveBeenNthCalledWith(1, 'info');
        expect(appendLineMock).toHaveBeenNthCalledWith(2, 'warn');
        expect(appendLineMock).toHaveBeenNthCalledWith(3, 'error');
    });

    it('updates verbosity when configuration changes', () => {
        configurationGetMock.mockReturnValue('error');
        const configurationChangeEmitter =
            new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
        mutable(vscode.workspace).onDidChangeConfiguration =
            configurationChangeEmitter.event;
        const logger = new OutputChannelLogger();

        logger.info('ignored info');
        configurationGetMock.mockReturnValue('info');
        configurationChangeEmitter.fire({ affectsConfiguration: () => true });
        logger.info('visible info');

        expect(appendLineMock).toHaveBeenCalledTimes(1);
        expect(appendLineMock).toHaveBeenCalledWith('visible info');
    });
});

describe('stringifyMessage', () => {
    it('should return the same string if message is a string', () => {
        const message = 'This is a test message';

        expect(stringifyMessage(message)).toBe(message);
    });

    it('should return the error string if message is an Error', () => {
        const message = new Error('This is an error message');

        expect(stringifyMessage(message)).toContain('This is an error message');
    });
    it('should return the JSON stringified object if message is an object', () => {
        const message = { key: 'value', number: 42 };
        const expected = JSON.stringify(message, undefined, '\t');

        expect(stringifyMessage(message)).toBe(expected);
    });

    it('should return the string representation for non-stringifiable objects', () => {
        const circularObj: Record<string, unknown> = {};
        circularObj.self = circularObj;

        expect(stringifyMessage(circularObj)).toBe(String(circularObj));
    });

    it('should return the string representation for BigInts', () => {
        const bigIntValue = 16n;

        expect(stringifyMessage(bigIntValue)).toBe(String(bigIntValue));
    });

    it('preserves textual form for non-finite numbers like NaN', () => {
        const value = NaN;

        expect(stringifyMessage(value)).toBe(String(value));
    });

    it('returns the string representation for undefined', () => {
        const value = undefined;

        expect(stringifyMessage(value)).toBe(String(value));
    });

    it('returns the string representation for Buffers', () => {
        const buf = Buffer.from('hello buffer');

        expect(stringifyMessage(buf)).toBe(buf.toString());
    });
});
