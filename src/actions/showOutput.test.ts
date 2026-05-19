import * as vscode from 'vscode';
import { ShowOutput } from './showOutput';
import { logger } from '../util/logger';

jest.mock('../util/logger');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const matching = calls.filter((c: unknown[]) => c[0] === command);
    if (!matching.length) {
        throw new Error(`No handler registered for command ${command}`);
    }
    const addCall = matching[matching.length - 1];
    const handler = addCall[1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
}

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
