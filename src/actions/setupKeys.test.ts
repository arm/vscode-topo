import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { SetupKeys, setupKeys as setupKeysOnTarget } from './setupKeys';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { executeTask } from '../util/executeTask';
import { executeCommand } from '../util/test/executeCommand';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('SetupKeys', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let topoCli: MockProxy<TopoCli>;
    let targetModel: TargetModel;
    const target = 'user@topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';

    beforeEach(() => {
        vi.clearAllMocks();
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers setup keys command', () => {
        const setupKeys = new SetupKeys(context, topoCli, targetModel);

        setupKeys.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            SetupKeys.setupKeysCommand,
            expect.any(Function),
        );
    });

    it('runs setup-keys task for selected board item', async () => {
        const setupKeys = new SetupKeys(context, topoCli, targetModel);
        setupKeys.activate();
        const boardItem = new TargetTreeItem(target, true, 'connected');

        await executeCommand(SetupKeys.setupKeysCommand, boardItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            [topoBinaryPath, 'setup-keys', '--target', target],
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            `Keys were set up on target ${target}.`,
        );
    });

    it('does nothing for non-selected board item', async () => {
        const setupKeys = new SetupKeys(context, topoCli, targetModel);
        setupKeys.activate();
        const boardItem = new TargetTreeItem(target, false, 'disconnected');

        await executeCommand(SetupKeys.setupKeysCommand, boardItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('falls back to selected target when no tree node is provided', async () => {
        const setupKeys = new SetupKeys(context, topoCli, targetModel);
        setupKeys.activate();

        await executeCommand(SetupKeys.setupKeysCommand, undefined);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            [topoBinaryPath, 'setup-keys', '--target', target],
        );
    });

    it('shows error when no target is available for setup-keys', async () => {
        targetModel.setSelected(undefined);
        const setupKeys = new SetupKeys(context, topoCli, targetModel);
        setupKeys.activate();

        await executeCommand(SetupKeys.setupKeysCommand, undefined);

        expect(executeTaskMock).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to set up keys on target. No selected target found',
        );
    });

    it('shows error when setup-keys fails', async () => {
        executeTaskMock.mockRejectedValueOnce(
            new Error('setup-keys failed with exit code 1'),
        );

        await setupKeysOnTarget(topoBinaryPath, target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining(
                `Failed to set up keys on target ${target}. setup-keys failed with exit code 1`,
            ),
        );
    });
});
