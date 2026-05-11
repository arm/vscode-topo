import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { SetupKeys } from './setupKeys';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { executeTask } from '../util/executeTask';
import { WrappedError } from '../errors/wrappedError';

jest.mock('../util/logger');
jest.mock('../util/executeTask');

const executeTaskMock = jest.mocked(executeTask);

describe('SetupKeys', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let targetStore: MockProxy<TargetStore>;
    const target = 'user@topo.local';

    beforeEach(() => {
        jest.clearAllMocks();
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
        expect(targetStore.getSelectedTarget).not.toHaveBeenCalled();
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

    it('shows error when no target is available for setup-keys', async () => {
        targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);
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

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to set up keys on target. No selected target found',
        );
    });

    it('shows error when selected target lookup fails with a TARGET error', async () => {
        targetStore.getSelectedTarget.mockRejectedValueOnce(
            new WrappedError('TARGET', 'target store failed'),
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

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to set up keys on target. target store failed',
        );
    });

    it('rethrows non-TARGET errors from selected target lookup', async () => {
        targetStore.getSelectedTarget.mockRejectedValueOnce(
            new Error('target lookup failed'),
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

        await expect(commandHandler(undefined)).rejects.toThrow(
            'target lookup failed',
        );

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
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
