import * as vscode from 'vscode';
import { buildQuickPickItems, TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetStore } from '../target/targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from '../target/containersManager';
import { mock, MockProxy } from 'jest-mock-extended';
import type { TopoCli } from '../topoCli';
import type { HealthCheckResult } from '../topoCliSchema';

jest.mock('../util/logger');

const healthyTarget: HealthCheckResult['target'] = {
    isLocalhost: false,
    connectivity: {
        status: 'ok',
        name: 'Connectivity',
        value: '',
    },
    dependencies: [{ status: 'ok', name: 'Container Engine', value: '' }],
    subsystemDriver: {
        status: 'ok',
        name: 'Subsystem Driver',
        value: '',
    },
};

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

const createTargetManager = () => {
    const onChangeEmitter = new vscode.EventEmitter<void>();
    const onDataUpdateEmitter = new vscode.EventEmitter<void>();
    const context = mock<vscode.ExtensionContext>({ subscriptions: [] });

    const targetTreeDataProvider: MockProxy<TargetTreeDataProvider> =
        mock<TargetTreeDataProvider>();

    const targetStore = mock<TargetStore>();
    targetStore.onChanged.mockImplementation(onChangeEmitter.event);
    targetStore.getTargets.mockReturnValue([]);

    const containersManager = mock<ContainersManager>();
    containersManager.getTargetState.mockResolvedValue({
        health: undefined,
        status: 'disconnected',
    });
    containersManager.getTargetStateSnapshot.mockReturnValue({
        health: undefined,
        status: 'disconnected',
    });
    containersManager.onDataUpdate.mockImplementation(
        onDataUpdateEmitter.event,
    );
    const topoCli: MockProxy<TopoCli> = mock<TopoCli>();
    const targetManager = new TargetManager(
        context,
        targetTreeDataProvider,
        targetStore,
        containersManager,
    );
    return {
        onChangeEmitter,
        onDataUpdateEmitter,
        targetTreeDataProvider,
        targetManager,
        targetStore,
        containersManager,
        topoCli,
        context,
    };
};

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const addCall = calls.find((c: unknown[]) => c[0] === command);
    const handler = addCall![1] as (...args: unknown[]) => Promise<void>;
    await handler(...args);
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

describe('TargetManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('activation', () => {
        it('registers tree provider and refresh command on activate', async () => {
            const { targetManager, context } = createTargetManager();

            await targetManager.activate();

            expect(vscode.window.createTreeView).toHaveBeenCalledWith(
                TargetManager.viewId,
                expect.anything(),
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                TargetManager.refreshCommand,
                expect.any(Function),
            );
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                TargetManager.addTargetCommand,
                expect.any(Function),
            );
            expect(context.subscriptions.length).toBeGreaterThan(0);
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
                show: jest.fn(() => {
                    if (selectedItem) {
                        onDidAcceptEmitter.fire();
                    } else {
                        onDidHideEmitter.fire();
                    }
                }),
            });
            jest.mocked(vscode.window.createQuickPick).mockReturnValueOnce(
                quickPick,
            );
            return quickPick;
        }

        it('handles addTargetCommand: prompts for ssh, stores and selects new target', async () => {
            const targetSsh = 'root@192.0.2.1';
            mockQuickPick({ label: targetSsh });
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).toHaveBeenCalledTimes(1);
            expect(targetStore.addTarget).toHaveBeenCalledWith(targetSsh);
            expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
        });

        it('does nothing when quick pick is dismissed', async () => {
            mockQuickPick(undefined);
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
            expect(targetStore.setSelected).not.toHaveBeenCalled();
        });

        it('shows error when targetStore.addTarget fails', async () => {
            mockQuickPick({ label: 'root@192.0.2.1' });
            const { targetStore, targetManager } = createTargetManager();
            const error = new Error('boom');
            jest.mocked(targetStore.addTarget).mockRejectedValueOnce(error);
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

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

    describe('status bar', () => {
        it('shows an item in the status bar with the currently selected target', async () => {
            const target = 'root@localhost';
            const { targetManager, targetStore } = createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target,
            );

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = jest.mocked(vscode.window.createStatusBarItem)
                .mock.results[0].value;
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
            expect(statusBarItem.command).toBe(TargetManager.FocusViewCommand);
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@localhost',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it("doesn't show an item in the status bar when no target is selected", async () => {
            const { targetManager } = createTargetManager();

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = jest.mocked(vscode.window.createStatusBarItem)
                .mock.results[0].value;
            expect(statusBarItem.text).toBe(undefined);
            expect(statusBarItem.tooltip).toBe(undefined);
            expect(statusBarItem.hide).toHaveBeenCalledTimes(1);
            expect(statusBarItem.show).not.toHaveBeenCalled();
        });

        it('changes the item in the status bar when the currently selected target changes', async () => {
            const target1 = 'root@localhost';
            const target2 = 'root@other-host';
            const {
                targetManager,
                targetStore,
                containersManager,
                onChangeEmitter,
            } = createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target1,
            );
            jest.mocked(
                containersManager.getTargetStateSnapshot,
            ).mockReturnValue({
                health: healthyTarget,
                status: 'connected',
            });
            await targetManager.activate();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target2,
            );
            jest.mocked(
                containersManager.getTargetStateSnapshot,
            ).mockReturnValue({
                health: healthyTarget,
                status: 'connected',
            });

            onChangeEmitter.fire();
            await waitImmediate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = jest.mocked(vscode.window.createStatusBarItem)
                .mock.results[0].value;
            expect(statusBarItem.text).toBe(`$(pass-filled) ${target2}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@other-host',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(2);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });
    });
});
