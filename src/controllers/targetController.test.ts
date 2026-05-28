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
        const targetStore = mock<TargetStore>({
            loadTargets: () => new Set(['host-a', 'host-b']),
            loadSelected: () => 'host-b',
        });
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
        const targetStore = mock<TargetStore>({
            loadTargets: () => new Set(),
        });
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        mockQuickPick({ label: targetSsh });

        await controller.promptToAdd();

        expect(targetStore.saveSelected).toHaveBeenCalledWith(targetSsh);
        expect(targetStore.saveTargets).toHaveBeenCalledWith(
            new Set([targetSsh]),
        );
        expect(targetModel.selected).toBe(targetSsh);
        expect(targetModel.targets).toEqual([targetSsh]);
    });

    it('does nothing when quick pick is dismissed', async () => {
        const targetStore = mock<TargetStore>({
            loadTargets: () => new Set(),
        });
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        mockQuickPick(undefined);

        await controller.promptToAdd();

        expect(targetStore.saveSelected).not.toHaveBeenCalled();
        expect(targetStore.saveTargets).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
        expect(targetModel.targets).toEqual([]);
    });

    it('shows error when loading targets fails', async () => {
        const targetStore = mock<TargetStore>({
            loadTargets: () => {
                throw new Error('oh no...');
            },
        });
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        mockQuickPick({ label: 'root@192.0.2.1' });

        await controller.promptToAdd();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('oh no...'),
        );
        expect(targetStore.saveSelected).not.toHaveBeenCalled();
    });
});

describe('target selection', () => {
    it('saves the selected target and updates model when select command is executed with a target item', async () => {
        const targetStore = mock<TargetStore>();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const targetItem = new TargetTreeItem('user@board', true, 'connected');

        await controller.select(targetItem);

        expect(targetStore.saveSelected).toHaveBeenCalledWith(
            targetItem.target,
        );
        expect(targetModel.selected).toBe(targetItem.target);
    });

    it('does nothing when select command is executed with a non-target item', async () => {
        const targetStore = mock<TargetStore>();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);

        await controller.select();

        expect(targetStore.saveSelected).not.toHaveBeenCalled();
        expect(targetModel.selected).toBeUndefined();
    });
});

describe('target removal', () => {
    it('deletes the target from the store when removeTarget is invoked with a target item', async () => {
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');
        const targetStore = mock<TargetStore>({
            loadTargets: () => new Set([targetItem.target]),
        });
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);

        await controller.remove(targetItem);

        expect(targetStore.saveTargets).toHaveBeenCalledWith(new Set());
    });

    it('selects a remaining target when the removed target was selected', async () => {
        const removedTarget = 'foo@bar.co';
        const remainingTarget = 'bar@bar.co';
        const targetStore = mock<TargetStore>({
            loadTargets: () => new Set([removedTarget, remainingTarget]),
            loadSelected: () => removedTarget,
        });
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const targetItem = new TargetTreeItem(removedTarget, true, 'connected');

        await controller.remove(targetItem);

        expect(targetStore.saveSelected).toHaveBeenCalledWith(remainingTarget);
        expect(targetModel.selected).toBe(remainingTarget);
    });

    it('does nothing when removeTarget is invoked with a non-target item', async () => {
        const targetStore = mock<TargetStore>();
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);

        await controller.remove();

        expect(targetStore.saveTargets).not.toHaveBeenCalled();
        expect(targetModel.targets).toEqual([]);
    });

    it('shows an error when loading targets fails', async () => {
        const targetStore = mock<TargetStore>({
            loadTargets: () => {
                throw new Error('IT BROKE');
            },
        });
        const targetModel = new TargetModel();
        const controller = new TargetController(targetModel, targetStore);
        const targetItem = new TargetTreeItem('foo@bar.co', true, 'connected');

        await controller.remove(targetItem);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('IT BROKE'),
        );
    });
});
