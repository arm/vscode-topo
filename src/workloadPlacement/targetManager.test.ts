import * as vscode from 'vscode';
import { TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('../util/logger');

const createTargetManager = async () => {
    const context = { subscriptions: [] };
    const targetTreeDataProvider = {
        refresh: jest.fn(),
    } as unknown as TargetTreeDataProvider;
    const targetStore = {
        addTarget: jest.fn(),
        setSelected: jest.fn(),
    } as unknown as TargetStore;
    const targetManager = new TargetManager(context as any, targetTreeDataProvider, targetStore);
    await targetManager.activate();
    return { targetTreeDataProvider, targetManager, targetStore };
};

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const addCall = calls.find((c: any[]) => c[0] === command);
    const handler = addCall![1] as (...args: any[]) => Promise<void>;
    await handler(...args);
}

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
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(TargetManager.AddTargetCommandType, expect.any(Function));
    });

    it('handles AddTargetCommandType: prompts for ssh and name, stores and selects new target', async () => {
        const { targetStore } = await createTargetManager();
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('root@192.0.2.1')
            .mockResolvedValueOnce('My target');

        await executeCommand(TargetManager.AddTargetCommandType);

        expect((targetStore.addTarget as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
        const created = (targetStore.addTarget as jest.Mock).mock.calls[0][0];
        expect(created).toBeDefined();
        expect(created.id).toBe('My target');
        expect(targetStore.setSelected).toHaveBeenCalledWith('My target');
    });

    it('does nothing when ssh input is cancelled', async () => {
        const { targetStore } = await createTargetManager();
        (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);

        await executeCommand(TargetManager.AddTargetCommandType);

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });

    it('does nothing when id input is cancelled', async () => {
        const { targetStore } = await createTargetManager();
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('root@192.0.2.1')
            .mockResolvedValueOnce(undefined);

        await executeCommand(TargetManager.AddTargetCommandType);

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });

    it('shows error when targetStore.addTarget fails', async () => {
        const { targetTreeDataProvider, targetStore } = await createTargetManager();
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('root@192.0.2.1')
            .mockResolvedValueOnce('My target');
        (targetStore.addTarget as jest.Mock).mockRejectedValueOnce(new Error('boom'));

        await executeCommand(TargetManager.AddTargetCommandType);

        expect(targetStore.addTarget).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('boom'));
        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(targetTreeDataProvider.refresh).not.toHaveBeenCalled();
    });

});
