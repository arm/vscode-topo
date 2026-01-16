import * as vscode from 'vscode';
import { TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from './containersManager';
import { Target } from './target';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('../util/logger');

const waitImmediate = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0));

const createTargetManager = () => {
    const onChangeEmitter = new vscode.EventEmitter<void>();
    const onDataUpdateEmitter = new vscode.EventEmitter<void>();
    const context = { subscriptions: [] };
    const targetTreeDataProvider = {
        refresh: jest.fn(),
    } as unknown as TargetTreeDataProvider;
    const targetStore: Pick<TargetStore, 'addTarget' | 'setSelected' | 'getSelectedTarget' | 'onChanged'> = {
        addTarget: jest.fn(),
        setSelected: jest.fn(),
        getSelectedTarget: jest.fn(),
        onChanged: onChangeEmitter.event,
    };
    const containersManager:Pick<ContainersManager, 'getBoardState' | 'onDataUpdate'> = {
        getBoardState: jest.fn(),
        onDataUpdate: onDataUpdateEmitter.event,
    };
    const targetManager = new TargetManager(context as any, targetTreeDataProvider, targetStore, containersManager);
    return {
        onChangeEmitter,
        onDataUpdateEmitter,
        targetTreeDataProvider,
        targetManager,
        targetStore,
        containersManager,
        context,
    };
};

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const addCall = calls.find((c: any[]) => c[0] === command);
    const handler = addCall![1] as (...args: any[]) => Promise<void>;
    await handler(...args);
}

let statusBarItems: vscode.StatusBarItem[] = [];
const mockedStatusBarItemCreation = (id: string, alignment: vscode.StatusBarAlignment, priority: number) => {
    const statusBarItem: vscode.StatusBarItem = {
        id,
        alignment,
        priority,
        name: undefined,
        text: '',
        tooltip: undefined,
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        accessibilityInformation: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
    };
    statusBarItems.push(statusBarItem);
    return statusBarItem;
};

describe('TargetManager', () => {

    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;

    beforeEach(() => {
        statusBarItems = [];
        jest.clearAllMocks();
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
    });

    describe('activation', () => {

        it('registers tree provider and refresh command on activate', async () => {
            const {targetManager, context } = createTargetManager();

            await targetManager.activate();

            expect(vscode.window.createTreeView).toHaveBeenCalledWith(TargetManager.viewId, expect.anything());
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(TargetManager.refreshCommand, expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(TargetManager.addTargetCommand, expect.any(Function));
            expect(context.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('target addition', () => {

        it('handles addTargetCommand: prompts for ssh and name, stores and selects new target', async () => {
            (vscode.window.showInputBox as jest.Mock)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce('My target');
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect((targetStore.addTarget as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
            const created = (targetStore.addTarget as jest.Mock).mock.calls[0][0];
            expect(created).toBeDefined();
            expect(created.id).toBe('My target');
            expect(targetStore.setSelected).toHaveBeenCalledWith('My target');
        });

        it('does nothing when ssh input is cancelled', async () => {
            (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
            expect(targetStore.setSelected).not.toHaveBeenCalled();
        });

        it('does nothing when id input is cancelled', async () => {
            (vscode.window.showInputBox as jest.Mock)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce(undefined);
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
            expect(targetStore.setSelected).not.toHaveBeenCalled();
        });

        it('shows error when targetStore.addTarget fails', async () => {
            (vscode.window.showInputBox as jest.Mock)
                .mockResolvedValueOnce('root@192.0.2.1')
                .mockResolvedValueOnce('My target');
            const { targetTreeDataProvider, targetStore, targetManager } = createTargetManager();
            const error = new Error('boom');
            (targetStore.addTarget as jest.Mock).mockRejectedValueOnce(error);
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to add target'), error);
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to add target'));
            expect(targetStore.setSelected).not.toHaveBeenCalled();
            expect(targetTreeDataProvider.refresh).not.toHaveBeenCalled();
        });

    });

    describe('status bar', () => {

        it('shows an item in the status bar with the currently selected target', async () => {
            const target = new Target('test', 'root@localhost');
            const { targetManager, targetStore, containersManager } = createTargetManager();
            (targetStore.getSelectedTarget as jest.Mock).mockResolvedValue(target);
            (containersManager.getBoardState as jest.Mock).mockResolvedValue({ isReachable: true, hasContainerRuntime: true, targetId: undefined });
            (vscode.window.createStatusBarItem as jest.Mock).mockImplementation(mockedStatusBarItemCreation);

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.command).toBe(TargetManager.FocusViewCommand);
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target.id}`);
            expect(statusBarItem.tooltip).toBe('Connection String: root@localhost');
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it('doesn\'t show an item in the status bar when no target is selected', async () => {
            const { targetManager, targetStore, containersManager } = createTargetManager();
            (targetStore.getSelectedTarget as jest.Mock).mockResolvedValue(undefined);
            (containersManager.getBoardState as jest.Mock).mockResolvedValue({ isReachable: false, hasContainerRuntime: true });
            (vscode.window.createStatusBarItem as jest.Mock).mockImplementation(mockedStatusBarItemCreation);

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe('');
            expect(statusBarItem.tooltip).toBe(undefined);
            expect(statusBarItem.hide).toHaveBeenCalledTimes(1);
            expect(statusBarItem.show).not.toHaveBeenCalled();
        });

        it('changes the item in the status bar when the currently selected target changes', async () => {
            const target1 = new Target('test', 'root@localhost');
            const target2 = new Target('test2', 'root@other-host');
            const { targetManager, targetStore, containersManager, onChangeEmitter } = createTargetManager();
            (targetStore.getSelectedTarget as jest.Mock).mockResolvedValue(target1);
            (containersManager.getBoardState as jest.Mock).mockResolvedValue({ isReachable: false, hasContainerRuntime: true });
            (vscode.window.createStatusBarItem as jest.Mock).mockImplementation(mockedStatusBarItemCreation);
            await targetManager.activate();
            (targetStore.getSelectedTarget as jest.Mock).mockResolvedValue(target2);
            (containersManager.getBoardState as jest.Mock).mockResolvedValue({ isReachable: true, hasContainerRuntime: true, targetId: target2.id });

            onChangeEmitter.fire();
            await waitImmediate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe(`$(pass-filled) ${target2.id}`);
            expect(statusBarItem.tooltip).toBe('Connection String: root@other-host');
            expect(statusBarItem.show).toHaveBeenCalledTimes(2);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it('logs an error if updating the status bar fails. Status bar stays unchanged', async () => {
            const target = new Target('test', 'root@localhost');
            const { targetManager, targetStore, containersManager, onDataUpdateEmitter } = createTargetManager();
            (targetStore.getSelectedTarget as jest.Mock).mockResolvedValue(target);
            (containersManager.getBoardState as jest.Mock).mockResolvedValue({ isReachable: true, hasContainerRuntime: true, targetId: target.id });
            (vscode.window.createStatusBarItem as jest.Mock).mockImplementation(mockedStatusBarItemCreation);
            await targetManager.activate();
            const error = new Error('boom');
            (containersManager.getBoardState as jest.Mock).mockRejectedValue(error);

            onDataUpdateEmitter.fire();
            await waitImmediate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe(`$(pass-filled) ${target.id}`);
            expect(statusBarItem.tooltip).toBe('Connection String: root@localhost');
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith("Failed to update target manager status bar", error);
        });

    });

});
