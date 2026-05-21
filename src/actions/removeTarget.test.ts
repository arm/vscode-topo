import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { RemoveTarget } from './removeTarget';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { executeCommand } from '../util/test/executeCommand';

jest.mock('../util/logger');

describe('RemoveTarget', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers the remove target command when activated', () => {
        const targetStore = mock<TargetStore>();
        const removeTarget = new RemoveTarget(targetStore);

        removeTarget.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            RemoveTarget.removeTargetCommand,
            expect.any(Function),
        );
    });

    it('invokes targetStore.deleteTarget when remove command is executed with a target item', async () => {
        const targetStore = mock<TargetStore>();
        const removeTarget = new RemoveTarget(targetStore);
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');
        removeTarget.activate();

        await executeCommand(RemoveTarget.removeTargetCommand, targetItem);

        expect(targetStore.deleteTarget).toHaveBeenCalledWith(
            targetItem.target,
        );
    });

    it('does not call deleteTarget when remove command is executed with a non-target item', async () => {
        const targetStore = mock<TargetStore>();
        const removeTarget = new RemoveTarget(targetStore);
        removeTarget.activate();

        await executeCommand(RemoveTarget.removeTargetCommand);

        expect(targetStore.deleteTarget).not.toHaveBeenCalled();
    });

    it('shows an error when deleteTarget fails', async () => {
        const targetStore = mock<TargetStore>();
        const removeTarget = new RemoveTarget(targetStore);
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');
        targetStore.deleteTarget.mockRejectedValue(
            new Error('Target not found'),
        );
        removeTarget.activate();

        await executeCommand(RemoveTarget.removeTargetCommand, targetItem);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to remove target',
        );
    });
});
