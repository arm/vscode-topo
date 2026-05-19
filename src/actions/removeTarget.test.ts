import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { RemoveTarget } from './removeTarget';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';

jest.mock('../util/logger');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const matching = calls.filter((c: unknown[]) => c[0] === command);
    if (!matching.length) {
        throw new Error(`No handler registered for command ${command}`);
    }
    const addCall = matching[matching.length - 1];
    const handler = addCall[1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
}

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
