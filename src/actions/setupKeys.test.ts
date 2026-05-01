import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { SetupKeys } from './setupKeys';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeTargetItem } from '../workloadPlacement/targetTreeTargetItem';
import { mutable } from '../util/mutable';

jest.mock('../util/logger');

describe('SetupKeys', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let targetStore: MockProxy<TargetStore>;
    const target = 'user@topo.local';
    const waitImmediate = () =>
        new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
    const taskExec: vscode.TaskExecution = {
        task: {} as vscode.Task,
        terminate: jest.fn(),
    };

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExec);
        const onDidEndTaskProcessEmitter =
            new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
        setTimeout(() => {
            onDidEndTaskProcessEmitter.fire({
                execution: taskExec,
                exitCode: 0,
            });
        }, 0);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers setup keys command', () => {
        const setupKeys = new SetupKeys(context, targetStore);

        setupKeys.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            SetupKeys.setupKeysCommand,
            expect.any(Function),
        );
    });

    it('runs setup-keys task for selected board item', async () => {
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();
        const boardItem = new TargetTreeTargetItem(target, true, 'connected');
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupKeys.setupKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(boardItem);
        await waitImmediate();

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'setup-keys',
            '--target',
            target,
        ]);
        expect(vscode.tasks.executeTask).toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            `Keys were set up on target ${target}.`,
        );
    });

    it('does nothing for non-selected board item', async () => {
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();
        const boardItem = new TargetTreeTargetItem(
            target,
            false,
            'disconnected',
        );
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupKeys.setupKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(boardItem);

        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('falls back to selected target when no tree node is provided', async () => {
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupKeys.setupKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(undefined);
        await waitImmediate();

        expect(targetStore.getSelectedTarget).toHaveBeenCalled();
        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'setup-keys',
            '--target',
            target,
        ]);
    });

    it('shows error when setup-keys fails', async () => {
        const onDidEndTaskProcessEmitter =
            new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExec);
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupKeys.setupKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        const running = commandHandler(undefined);
        await waitImmediate();
        onDidEndTaskProcessEmitter.fire({
            execution: taskExec,
            exitCode: 1,
        });
        await running;

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining(
                `Failed to set up keys on target ${target}. setup-keys failed with exit code 1`,
            ),
        );
    });
});
