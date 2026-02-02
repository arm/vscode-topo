import * as vscode from 'vscode';
import { OnBoardTopoConsoleOpener } from './onboardTopoConsoleOpener';

jest.mock('vscode');

describe('OnBoardTopoConsoleOpener', () => {
    let context: Pick<vscode.ExtensionContext, 'subscriptions'>;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const targetUrl = 'http://topo.local';
    let targetStore: { getSelectedTarget: jest.Mock };

    const activateOnBoardTopoConsoleOpener = (
        context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        targetStore: { getSelectedTarget: jest.Mock },
    ) => {
        const onBoardTopoConsoleOpener = new OnBoardTopoConsoleOpener(
            context,
            targetStore,
        );
        onBoardTopoConsoleOpener.activate();
        return onBoardTopoConsoleOpener;
    };

    beforeEach(() => {
        context = { subscriptions: [] };
        targetStore = {
            getSelectedTarget: jest
                .fn()
                .mockResolvedValue({ host: 'topo.local' }),
        };
        commandHandler = undefined;
        jest.mocked(vscode.commands.registerCommand).mockImplementation(
            (command, callback) => {
                commandHandler = { command, callback };
                return { dispose: jest.fn() };
            },
        );
        jest.mocked(vscode.commands.executeCommand).mockImplementation(
            async (command, ...args) => {
                if (
                    command ===
                        OnBoardTopoConsoleOpener.openTopoConsoleCommand &&
                    commandHandler
                ) {
                    return commandHandler.callback(...args);
                }
                return Promise.resolve();
            },
        );
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('registers the openTopoConsole command', () => {
        activateOnBoardTopoConsoleOpener(context, targetStore);
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            OnBoardTopoConsoleOpener.openTopoConsoleCommand,
            expect.any(Function),
        );
    });

    it('opens the on-board Topo console URL in the browser', async () => {
        jest.mocked(vscode.env.openExternal).mockResolvedValue(true);
        activateOnBoardTopoConsoleOpener(context, targetStore);

        await vscode.commands.executeCommand(
            OnBoardTopoConsoleOpener.openTopoConsoleCommand,
        );

        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse(targetUrl),
        );
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows an error message if openExternal fails', async () => {
        jest.mocked(vscode.env.openExternal).mockRejectedValue(
            new Error('fail'),
        );
        activateOnBoardTopoConsoleOpener(context, targetStore);

        await vscode.commands.executeCommand(
            OnBoardTopoConsoleOpener.openTopoConsoleCommand,
        );

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to open board console'),
        );
    });
});
