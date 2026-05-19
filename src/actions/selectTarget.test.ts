import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { SelectTarget } from './selectTarget';

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

describe('SelectTarget', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers the select target command when activated', () => {
        const targetStore = mock<TargetStore>();
        const selectTarget = new SelectTarget(targetStore);

        selectTarget.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            SelectTarget.selectTargetCommand,
            expect.any(Function),
        );
    });

    it('invokes targetStore.setSelected when select command is executed with a target item', async () => {
        const targetStore = mock<TargetStore>();
        const selectTarget = new SelectTarget(targetStore);
        selectTarget.activate();
        const targetItem = new TargetTreeItem('user@board', true, 'connected');

        await executeCommand(SelectTarget.selectTargetCommand, targetItem);

        expect(targetStore.setSelected).toHaveBeenCalledWith(targetItem.target);
    });

    it('does not call setSelected when select command is executed with a non-target item', async () => {
        const targetStore = mock<TargetStore>();
        const selectTarget = new SelectTarget(targetStore);
        selectTarget.activate();

        await executeCommand(SelectTarget.selectTargetCommand);

        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});
