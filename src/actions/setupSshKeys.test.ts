import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { SetupSshKeys } from './setupSshKeys';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeTargetItem } from '../workloadPlacement/targetTreeTargetItem';
import { TargetItem } from '../util/types';
import { mutable } from '../util/mutable';

jest.mock('../util/logger');

describe('SetupSshKeys', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let targetStore: MockProxy<TargetStore>;
    const target: TargetItem = {
        ssh: 'user@topo.local',
    };
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

    it('registers setup-keys command', () => {
        const setupSshKeys = new SetupSshKeys(context, targetStore);

        setupSshKeys.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            SetupSshKeys.setupSshKeysCommand,
            expect.any(Function),
        );
    });

    it('runs setup-keys task for selected board item', async () => {
        const setupSshKeys = new SetupSshKeys(context, targetStore);
        setupSshKeys.activate();
        const boardItem = new TargetTreeTargetItem(target, true, true, true);
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupSshKeys.setupSshKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(boardItem);
        await waitImmediate();

        expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
            'setup-keys',
            '--target',
            target.ssh,
        ]);
        expect(vscode.tasks.executeTask).toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            `SSH keys were set up on target ${target.ssh}.`,
        );
    });

    it('does nothing for non-selected board item', async () => {
        const setupSshKeys = new SetupSshKeys(context, targetStore);
        setupSshKeys.activate();
        const boardItem = new TargetTreeTargetItem(target, false, false, false);
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupSshKeys.setupSshKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(boardItem);

        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('falls back to selected target when no tree node is provided', async () => {
        const setupSshKeys = new SetupSshKeys(context, targetStore);
        setupSshKeys.activate();
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupSshKeys.setupSshKeysCommand,
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
            target.ssh,
        ]);
    });

    it('shows error when setup-keys fails', async () => {
        const onDidEndTaskProcessEmitter =
            new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExec);
        const setupSshKeys = new SetupSshKeys(context, targetStore);
        setupSshKeys.activate();
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupSshKeys.setupSshKeysCommand,
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
                `Failed to set up SSH keys on target ${target.ssh}. setup-keys failed with exit code 1`,
            ),
        );
    });
});
