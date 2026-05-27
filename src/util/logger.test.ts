import { OutputChannelLogger, stringifyMessage } from './logger';
import * as vscode from 'vscode';
import { mutable } from './mutable';
import { mock, MockProxy } from 'vitest-mock-extended';

describe('OutputChannelLogger', () => {
    let outputChannelMock: MockProxy<vscode.LogOutputChannel>;
    let configurationMock: MockProxy<vscode.WorkspaceConfiguration>;

    beforeEach(() => {
        outputChannelMock = mock<vscode.LogOutputChannel>();
        configurationMock = mock<vscode.WorkspaceConfiguration>();

        vi.mocked(vscode.window.createOutputChannel).mockReturnValue(
            outputChannelMock,
        );
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
            configurationMock,
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('does not log when verbosity is off', () => {
        configurationMock.get.mockReturnValue('off');
        const logger = new OutputChannelLogger();

        logger.error('error');
        logger.warn('warn');
        logger.info('info');
        logger.debug('debug');

        expect(outputChannelMock.appendLine).not.toHaveBeenCalled();
    });

    it('uses default verbosity when configuration is missing', () => {
        configurationMock.get.mockReturnValue(undefined);
        const logger = new OutputChannelLogger();

        logger.info('ignored info');
        logger.warn('visible warn');

        expect(outputChannelMock.appendLine).toHaveBeenCalledTimes(1);
        expect(outputChannelMock.appendLine).toHaveBeenCalledWith(
            'visible warn',
        );
    });

    it('logs messages only when within the current verbosity', () => {
        configurationMock.get.mockReturnValue('info');
        const logger = new OutputChannelLogger();

        logger.debug('debug');
        logger.info('info');
        logger.warn('warn');
        logger.error('error');

        expect(outputChannelMock.appendLine).toHaveBeenCalledTimes(3);
        expect(outputChannelMock.appendLine).toHaveBeenNthCalledWith(1, 'info');
        expect(outputChannelMock.appendLine).toHaveBeenNthCalledWith(2, 'warn');
        expect(outputChannelMock.appendLine).toHaveBeenNthCalledWith(
            3,
            'error',
        );
    });

    it('updates verbosity when configuration changes', () => {
        configurationMock.get.mockReturnValue('error');
        const configurationChangeEmitter =
            new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
        mutable(vscode.workspace).onDidChangeConfiguration =
            configurationChangeEmitter.event;

        const logger = new OutputChannelLogger();

        logger.info('ignored info');
        configurationMock.get.mockReturnValue('info');
        configurationChangeEmitter.fire({ affectsConfiguration: () => true });
        logger.info('visible info');

        expect(outputChannelMock.appendLine).toHaveBeenCalledTimes(1);
        expect(outputChannelMock.appendLine).toHaveBeenCalledWith(
            'visible info',
        );
    });

    it('disposes configuration listener and output channel', () => {
        configurationMock.get.mockReturnValue('warn');
        const configurationChangeDisposable = mock<vscode.Disposable>();
        mutable(vscode.workspace).onDidChangeConfiguration = vi.fn(
            () => configurationChangeDisposable,
        );
        const logger = new OutputChannelLogger();
        logger.warn('visible warn');

        logger.dispose();

        expect(configurationChangeDisposable.dispose).toHaveBeenCalled();
        expect(outputChannelMock.dispose).toHaveBeenCalled();
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
