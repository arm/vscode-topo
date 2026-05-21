import * as vscode from 'vscode';
import { ShowOutput } from './showOutput';
import { logger } from '../util/logger';
import { executeCommand } from '../util/test/executeCommand';

jest.mock('../util/logger');

describe('ShowOutput', () => {
    it('activation registers the command', () => {
        const showOutput = new ShowOutput();

        showOutput.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            ShowOutput.showOutputCommand,
            expect.any(Function),
        );
    });

    it('show host dependencies output command opens the Arm Topo output channel', async () => {
        const showOutput = new ShowOutput();
        showOutput.activate();

        await executeCommand(ShowOutput.showOutputCommand);

        expect(logger.show).toHaveBeenCalled();
    });
});
