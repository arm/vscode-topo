import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { SelectTarget } from './selectTarget';
import { executeCommand } from '../util/test/executeCommand';

jest.mock('../util/logger');

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
