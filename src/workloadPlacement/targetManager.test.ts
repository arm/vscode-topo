import * as vscode from 'vscode';
import { TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');

const createTargetManager = async () => {
    const context = { subscriptions: [] };
    const targetTreeDataProvider = {
        refresh: jest.fn(),
    } as unknown as TargetTreeDataProvider;
    const targetManager = new TargetManager(context as any, targetTreeDataProvider);
    await targetManager.activate();
    return { targetTreeDataProvider, targetManager };
};

describe('TargetManager', () => {

    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
    });

    it('registers tree provider and refresh command on activate', async () => {
        await createTargetManager();
        expect(vscode.window.createTreeView).toHaveBeenCalledWith(TargetManager.TargetManagerViewId, expect.anything());
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(TargetManager.RefreshCommandType, expect.any(Function));
    });

});
