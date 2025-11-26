import * as vscode from 'vscode';
import { OnBoardTopoConsoleOpener } from './onboardTopoConsoleOpener';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');

describe('OnBoardTopoConsoleOpener', () => {
    let context: { subscriptions: any[] };
    let commandHandler: { command: string; callback: (...args: any[]) => void } | undefined;
    const targetUrl = 'http://topo.local';
    let targetStore: { getSelectedTarget: jest.Mock };

    const activateOnBoardTopoConsoleOpener = (context: vscode.ExtensionContext, targetStore: { getSelectedTarget: jest.Mock }) => {
        const onBoardTopoConsoleOpener = new OnBoardTopoConsoleOpener(context, targetStore);
        onBoardTopoConsoleOpener.activate();
        return onBoardTopoConsoleOpener;
    };

    beforeEach(() => {
        context = { subscriptions: [] };
        targetStore = { getSelectedTarget: jest.fn().mockResolvedValue({ host: 'topo.local' }) };
        commandHandler = undefined;
        (vscode.commands.registerCommand as jest.Mock).mockClear();
        (vscode.env.openExternal as jest.Mock).mockClear();
        (vscode.window.showErrorMessage as jest.Mock).mockClear();
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((command, callback) => {
            commandHandler = { command, callback };
            return { dispose: jest.fn() };
        });
        (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
            if (command === OnBoardTopoConsoleOpener.openTopoConsoleCommand && commandHandler) {
                return commandHandler.callback(...args);
            }
            return Promise.resolve();
        });
    });

    it('registers the openTopoConsole command', () => {
        activateOnBoardTopoConsoleOpener(context as any, targetStore);
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            OnBoardTopoConsoleOpener.openTopoConsoleCommand,
            expect.any(Function)
        );
    });

    it('opens the on-board Topo console URL in the browser', async () => {
        (vscode.env.openExternal as jest.Mock).mockResolvedValue(true);
        activateOnBoardTopoConsoleOpener(context as any, targetStore);

        await vscode.commands.executeCommand(OnBoardTopoConsoleOpener.openTopoConsoleCommand);

        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse(targetUrl)
        );
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows an error message if openExternal fails', async () => {
        (vscode.env.openExternal as jest.Mock).mockRejectedValue(new Error('fail'));
        activateOnBoardTopoConsoleOpener(context as any, targetStore);

        await vscode.commands.executeCommand(OnBoardTopoConsoleOpener.openTopoConsoleCommand);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to open board console')
        );
    });
});
