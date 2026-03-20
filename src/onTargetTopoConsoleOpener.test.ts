import * as vscode from 'vscode';
import { OnTargetTopoConsoleOpener } from './onTargetTopoConsoleOpener';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from './workloadPlacement/targetStore';
import { TargetItem } from './util/types';

describe('OnTargetTopoConsoleOpener', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let commandHandler:
        | { command: string; callback: (...args: unknown[]) => void }
        | undefined;
    const targetUrl = 'http://topo.local';
    let targetStore: MockProxy<TargetStore>;
    const target: TargetItem = {
        id: 'topo',
        ssh: 'topo.local',
        host: 'topo.local',
    };

    const activateOnTargetTopoConsoleOpener = (
        context: vscode.ExtensionContext,
        targetStore: TargetStore,
    ) => {
        const onTargetTopoConsoleOpener = new OnTargetTopoConsoleOpener(
            context,
            targetStore,
        );
        onTargetTopoConsoleOpener.activate();
        return onTargetTopoConsoleOpener;
    };

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
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
                        OnTargetTopoConsoleOpener.openTopoConsoleCommand &&
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
        activateOnTargetTopoConsoleOpener(context, targetStore);
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            OnTargetTopoConsoleOpener.openTopoConsoleCommand,
            expect.any(Function),
        );
    });

    it('opens the on-target Topo console URL in the browser', async () => {
        jest.mocked(vscode.env.openExternal).mockResolvedValue(true);
        activateOnTargetTopoConsoleOpener(context, targetStore);

        await vscode.commands.executeCommand(
            OnTargetTopoConsoleOpener.openTopoConsoleCommand,
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
        activateOnTargetTopoConsoleOpener(context, targetStore);

        await vscode.commands.executeCommand(
            OnTargetTopoConsoleOpener.openTopoConsoleCommand,
        );

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to open target console'),
        );
    });
});
