import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { SetupKeys } from './setupKeys';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { executeTask } from '../util/executeTask';

jest.mock('../util/logger');
jest.mock('../util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

describe('SetupKeys', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let targetStore: MockProxy<TargetStore>;
    const target = 'user@topo.local';

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
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
        const boardItem = new TargetTreeItem(target, true, 'connected');
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupKeys.setupKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(boardItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            ['topo', 'setup-keys', '--target', target],
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            `Keys were set up on target ${target}.`,
        );
    });

    it('does nothing for non-selected board item', async () => {
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();
        const boardItem = new TargetTreeItem(target, false, 'disconnected');
        const commandHandler = jest
            .mocked(vscode.commands.registerCommand)
            .mock.calls.find(
                ([command]) => command === SetupKeys.setupKeysCommand,
            )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;
        if (!commandHandler) {
            throw new Error('No command handler registered');
        }

        await commandHandler(boardItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
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

        expect(targetStore.getSelectedTarget).toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            ['topo', 'setup-keys', '--target', target],
        );
    });

    it('shows error when setup-keys fails', async () => {
        executeTaskMock.mockRejectedValueOnce(
            new Error('setup-keys failed with exit code 1'),
        );
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

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining(
                `Failed to set up keys on target ${target}. setup-keys failed with exit code 1`,
            ),
        );
    });
});
