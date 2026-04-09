import * as vscode from 'vscode';
import { ContainerExplorer } from './containerExplorer';
import { ContainerTreeDataProvider } from './containerTreeDataProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');

const createContainerExplorer = async () => {
    const context = { subscriptions: [] };
    const containerTreeDataProvider = {
        refresh: jest.fn(),
    } as unknown as ContainerTreeDataProvider;
    const containerExplorer = new ContainerExplorer(context as any, containerTreeDataProvider);
    await containerExplorer.activate();
    return { containerTreeDataProvider, containerExplorer };
};

describe('ContainerExplorer', () => {

    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.window.registerTreeDataProvider as jest.Mock).mockReturnValue({ dispose: jest.fn() });
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
        (vscode.window.createTerminal as jest.Mock).mockReturnValue({
            sendText: jest.fn(),
            show: jest.fn(),
        });
    });

    it('registers tree provider and refresh command on activate', async () => {
        await createContainerExplorer();
        expect(vscode.window.createTreeView).toHaveBeenCalledWith('containerExplorer', expect.anything());
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('containerExplorer.refresh', expect.any(Function));
    });

});
