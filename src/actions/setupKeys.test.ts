import * as vscode from 'vscode';
import { SetupKeys, setupKeys as setupKeysOnTarget } from './setupKeys';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { executeTask } from '../util/executeTask';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { MockProxy, mock } from 'vitest-mock-extended';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

describe('SetupKeys', () => {
    let topoCli: MockProxy<TopoCli>;
    let targetModel: TargetModel;
    const target = 'user@topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';

    beforeEach(() => {
        vi.clearAllMocks();
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('runs setup-keys task for selected board item', async () => {
        const setupKeys = new SetupKeys(topoCli, targetModel);
        const boardItem = new TargetTreeItem(target, true, 'connected');

        await setupKeys.setupKeysCommandHandler(boardItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            [topoBinaryPath, 'setup-keys', '--target', target],
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            `Keys were set up on target ${target}.`,
        );
    });

    it('does nothing for non-selected board item', async () => {
        const setupKeys = new SetupKeys(topoCli, targetModel);
        const boardItem = new TargetTreeItem(target, false, 'disconnected');

        await setupKeys.setupKeysCommandHandler(boardItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('falls back to selected target when no tree node is provided', async () => {
        const setupKeys = new SetupKeys(topoCli, targetModel);

        await setupKeys.setupKeysCommandHandler(undefined);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Setup keys on ${target}`,
            [topoBinaryPath, 'setup-keys', '--target', target],
        );
    });

    it('shows error when no target is available for setup-keys', async () => {
        targetModel.setSelected(undefined);
        const setupKeys = new SetupKeys(topoCli, targetModel);

        await setupKeys.setupKeysCommandHandler(undefined);

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
