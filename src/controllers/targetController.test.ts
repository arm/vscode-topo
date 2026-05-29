import { mock } from 'vitest-mock-extended';
import { buildQuickPickItems, TargetController } from './targetController';
import * as vscode from 'vscode';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetStore } from '../target/targetStore';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/logger');

afterEach(() => {
    vi.clearAllMocks();
});

function mockTargetStore(
    initialTargets: string[] = [],
    initialSelected?: string,
) {
    let targets = initialTargets;
    let selected = initialSelected;
    const targetStore = mock<TargetStore>();
    targetStore.getTargets.mockImplementation(() => targets);
    targetStore.getSelectedTarget.mockImplementation(() =>
        targets.includes(selected ?? '') ? selected : undefined,
    );
    targetStore.addTarget.mockImplementation(async (target) => {
        targets = [...targets, target];
    });
    targetStore.setSelected.mockImplementation(async (target) => {
        selected = target;
    });
    targetStore.deleteTarget.mockImplementation(async (target) => {
        targets = targets.filter((existing) => existing !== target);
        if (selected === target) {
            selected = [...targets].sort((a, b) => a.localeCompare(b))[0];
        }
    });
    return targetStore;
}

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

describe('target construction', () => {
    it('loads targets and selected target into the model', () => {
        const targetStore = mockTargetStore(['host-a', 'host-b'], 'host-b');
        const targetModel = new TargetModel();

        new TargetController(targetModel, targetStore);

        expect(targetModel.targets).toEqual(['host-a', 'host-b']);
        expect(targetModel.selected).toBe('host-b');
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
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        mockQuickPick({ label: targetSsh });

        await controller.addCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalledWith(targetSsh);
        expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
        expect(targetModel.selected).toBe(targetSsh);
        expect(targetModel.targets).toEqual([targetSsh]);
    });

    it('does nothing when quick pick is dismissed', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        mockQuickPick(undefined);

        await controller.addCommandHandler();

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.targets).toEqual([]);
    });

    it('shows error when targetStore.addTarget fails', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const error = new Error('boom');
        targetStore.addTarget.mockRejectedValueOnce(error);
        mockQuickPick({ label: 'root@192.0.2.1' });

        await controller.addCommandHandler();

        expect(targetStore.addTarget).toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to add target'),
        );
        expect(targetStore.setSelected).not.toHaveBeenCalled();
    });
});

describe('target selection', () => {
    it('saves the selected target and updates model when select command is executed with a target item', async () => {
        const targetStore = mockTargetStore(['user@board']);
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const targetItem = new TargetTreeItem('user@board', true, 'connected');

        await controller.selectCommandHandler(targetItem);

        expect(targetStore.setSelected).toHaveBeenCalledWith(targetItem.target);
        expect(targetModel.selected).toBe(targetItem.target);
    });

    it('does nothing when select command is executed with a non-target item', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);

        await controller.selectCommandHandler();

        expect(targetStore.setSelected).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
    });
});

describe('target removal', () => {
    it('deletes the target from the store when removeTarget is invoked with a target item', async () => {
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');
        const targetStore = mockTargetStore([targetItem.target]);
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);

        await controller.removeCommandHandler(targetItem);

        expect(targetStore.deleteTarget).toHaveBeenCalledWith(
            targetItem.target,
        );
        expect(targetModel.targets).toEqual([]);
    });

    it('selects a remaining target when the removed target was selected', async () => {
        const removedTarget = 'foo@bar.co';
        const remainingTarget = 'bar@bar.co';
        const targetStore = mockTargetStore(
            [removedTarget, remainingTarget],
            removedTarget,
        );
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const targetItem = new TargetTreeItem(removedTarget, true, 'connected');

        await controller.removeCommandHandler(targetItem);

        expect(targetStore.deleteTarget).toHaveBeenCalledWith(removedTarget);
        expect(targetModel.selected).toBe(remainingTarget);
    });

    it('does nothing when removeTarget is invoked with a non-target item', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);

        await controller.removeCommandHandler();

        expect(targetStore.deleteTarget).not.toHaveBeenCalled();
        expect(targetModel.targets).toEqual([]);
    });

    it('shows an error when deleteTarget fails', async () => {
        const targetStore = mockTargetStore();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');
        targetStore.deleteTarget.mockRejectedValue(
            new Error('Target not found'),
        );

        await controller.removeCommandHandler(targetItem);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to remove target'),
        );
    });
});
