import { OutputChannelLogger, stringifyMessage } from './logger';
import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';

describe('OutputChannelLogger', () => {
    let outputChannelMock: MockProxy<vscode.LogOutputChannel>;

    beforeEach(() => {
        outputChannelMock = mock<vscode.LogOutputChannel>();

        vi.mocked(vscode.window.createOutputChannel).mockReturnValue(
            outputChannelMock,
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('creates a VS Code log output channel when logging', () => {
        const logger = new OutputChannelLogger();

        logger.info('message');

        expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Topo', {
            log: true,
        });
    });

    it('logs messages through the matching log output channel methods', () => {
        const logger = new OutputChannelLogger();

        logger.error('error');
        logger.warn('warn');
        logger.info('info');
        logger.debug('debug');

        expect(outputChannelMock.error).toHaveBeenCalledWith('error');
        expect(outputChannelMock.warn).toHaveBeenCalledWith('warn');
        expect(outputChannelMock.info).toHaveBeenCalledWith('info');
        expect(outputChannelMock.debug).toHaveBeenCalledWith('debug');
    });

    it('stringifies each message before logging it', () => {
        const logger = new OutputChannelLogger();
        const message = { key: 'value' };

        logger.info('plain', message);

        expect(outputChannelMock.info).toHaveBeenNthCalledWith(1, 'plain');
        expect(outputChannelMock.info).toHaveBeenNthCalledWith(
            2,
            JSON.stringify(message, undefined, '\t'),
        );
    });

    it('shows the output channel even before any messages are logged', () => {
        const logger = new OutputChannelLogger();

        logger.show();

        expect(outputChannelMock.show).toHaveBeenCalled();
    });

    it('disposes the output channel', () => {
        const logger = new OutputChannelLogger();
        logger.warn('visible warn');

        logger.dispose();

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
