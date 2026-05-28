import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { SetupKeys, setupKeys as setupKeysOnTarget } from './setupKeys';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { executeTask } from '../util/executeTask';
import { executeCommand } from '../util/test/executeCommand';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('SetupKeys', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let targetStore: MockProxy<TargetStore>;
    const target = 'user@topo.local';

    beforeEach(() => {
        vi.clearAllMocks();
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockReturnValue(target);
    });

    afterEach(() => {
        vi.clearAllMocks();
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

        await executeCommand(SetupKeys.setupKeysCommand, boardItem);

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

        await executeCommand(SetupKeys.setupKeysCommand, boardItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('falls back to selected target when no tree node is provided', async () => {
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();

        await executeCommand(SetupKeys.setupKeysCommand, undefined);

        expect(targetStore.getSelectedTarget).toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            ['topo', 'setup-keys', '--target', target],
        );
    });

    it('shows error when no target is available for setup-keys', async () => {
        targetStore.getSelectedTarget.mockReturnValueOnce(undefined);
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();

        await executeCommand(SetupKeys.setupKeysCommand, undefined);

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to set up keys on target. No selected target found',
        );
    });

    it('rethrows errors from selected target lookup', async () => {
        targetStore.getSelectedTarget.mockImplementationOnce(() => {
            throw new Error('target lookup failed');
        });
        const setupKeys = new SetupKeys(context, targetStore);
        setupKeys.activate();

        await expect(
            executeCommand(SetupKeys.setupKeysCommand, undefined),
        ).rejects.toThrow('target lookup failed');

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('shows error when setup-keys fails', async () => {
        executeTaskMock.mockRejectedValueOnce(
            new Error('setup-keys failed with exit code 1'),
        );

        await setupKeysOnTarget(target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining(
                `Failed to set up keys on target ${target}. setup-keys failed with exit code 1`,
            ),
        );
    });
});
