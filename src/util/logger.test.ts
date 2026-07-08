import { OutputChannelLogger } from './logger';
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

    it('forwards additional arguments to the log output channel', () => {
        const logger = new OutputChannelLogger();
        const context = { key: 'value' };

        logger.warn('plain', context);

        expect(outputChannelMock.warn).toHaveBeenCalledOnce();
        expect(outputChannelMock.warn).toHaveBeenCalledWith('plain', context);
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
