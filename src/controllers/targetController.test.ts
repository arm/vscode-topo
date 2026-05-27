import { mock } from 'vitest-mock-extended';
import { buildQuickPickItems, TargetController } from './targetController';
import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetStore } from '../target/targetStore';

vi.mock('../util/logger');

afterEach(() => {
    vi.clearAllMocks();
});

describe('buildQuickPickItems', () => {
    it('returns hosts', () => {
        const items = buildQuickPickItems(['host-a', 'host-b'], '');

        expect(items).toEqual([{ label: 'host-a' }, { label: 'host-b' }]);
    });

    it('prepends a manual entry when filter does not match any host', () => {
        const items = buildQuickPickItems(['host-a'], 'root@10.0.0.1');

        expect(items[0]).toEqual({
            label: 'root@10.0.0.1',
            description: 'Add new SSH target',
        });
        expect(items[1]).toEqual({ label: 'host-a' });
    });

    it('does not prepend manual entry when filter matches a host (case-insensitive)', () => {
        const items = buildQuickPickItems(['Host-A'], 'host-a');

        expect(items[0]).toEqual({ label: 'Host-A' });
    });

    it('does not prepend manual entry when filter is whitespace-only', () => {
        const items = buildQuickPickItems(['host-a'], '   ');

        expect(items[0]).toEqual({ label: 'host-a' });
    });

    it('trims whitespace from the filter for the manual entry label', () => {
        const items = buildQuickPickItems([], '  my-host  ');

        expect(items[0]).toEqual({
            label: 'my-host',
            description: 'Add new SSH target',
        });
    });

    it('returns nothing when no hosts and empty filter', () => {
        const items = buildQuickPickItems([], '');

        expect(items).toEqual([]);
    });
});

describe('target addition', () => {
    function mockQuickPick(selectedItem: vscode.QuickPickItem | undefined) {
        const onDidAcceptEmitter = new vscode.EventEmitter<void>();
        const onDidHideEmitter = new vscode.EventEmitter<void>();
        const onDidChangeValueEmitter = new vscode.EventEmitter<string>();
        const quickPick = mock<vscode.QuickPick<vscode.QuickPickItem>>({
            title: '',
            placeholder: '',
            items: [] as vscode.QuickPickItem[],
            selectedItems: selectedItem ? [selectedItem] : [],
            onDidAccept: onDidAcceptEmitter.event,
            onDidHide: onDidHideEmitter.event,
            onDidChangeValue: onDidChangeValueEmitter.event,
            show: vi.fn(() => {
                if (selectedItem) {
                    onDidAcceptEmitter.fire();
                } else {
                    onDidHideEmitter.fire();
                }
            }),
        });
        vi.mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPick);
        return quickPick;
    }

    it('prompts for ssh, stores and selects new target', async () => {
        const targetSsh = 'root@192.0.2.1';
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);
        mockQuickPick({ label: targetSsh });

        await controller.promptToAdd();

        expect(targetStore.addTarget).toHaveBeenCalledTimes(1);
        expect(targetStore.addTarget).toHaveBeenCalledWith(targetSsh);
        expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
    });

    it('does nothing when quick pick is dismissed', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);
        mockQuickPick(undefined);

        await controller.promptToAdd();

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });

    it('shows error when targetStore.addTarget fails', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);
        const error = new Error('boom');
        vi.mocked(targetStore.addTarget).mockRejectedValueOnce(error);
        mockQuickPick({ label: 'root@192.0.2.1' });

        await controller.promptToAdd();

        expect(targetStore.addTarget).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to add target'),
            error,
        );
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to add target'),
        );
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});

describe('target selection', () => {
    it('invokes targetStore.setSelected when select command is executed with a target item', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);
        const targetItem = new TargetTreeItem('user@board', true, 'connected');

        await controller.select(targetItem);

        expect(targetStore.setSelected).toHaveBeenCalledWith(targetItem.target);
    });

    it('does not call setSelected when select command is executed with a non-target item', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);

        await controller.select();

        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});

describe('target removal', () => {
    it('invokes targetStore.deleteTarget when removeTarget is invoked with a target item', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');

        await controller.remove(targetItem);

        expect(targetStore.deleteTarget).toHaveBeenCalledWith(
            targetItem.target,
        );
    });

    it('does not call deleteTarget when removeTarget is invoked with a non-target item', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);

        await controller.remove();

        expect(targetStore.deleteTarget).not.toHaveBeenCalled();
    });

    it('shows an error when deleteTarget fails', async () => {
        const targetStore = mock<TargetStore>();
        const controller = new TargetController(targetStore);
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');
        targetStore.deleteTarget.mockRejectedValue(
            new Error('Target not found'),
        );
        await controller.remove(targetItem);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to remove target'),
        );
    });
});
