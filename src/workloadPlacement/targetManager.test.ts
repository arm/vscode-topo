import * as fs from 'fs';
import * as vscode from 'vscode';
import { TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetStore } from './targetStore';
import { logger } from '../util/logger';
import { ContainersManager } from './containersManager';
import { TargetItem } from '../util/types';
import { mock, MockProxy } from 'jest-mock-extended';
import type { TopoCli } from '../topoCli';
import type { HealthCheckResult } from '../topoCliSchema';

jest.mock('fs');
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

type QuickPickCallback = (...args: unknown[]) => void;

function createMockQuickPick() {
    const listeners: Record<string, QuickPickCallback[]> = {
        accept: [],
        hide: [],
        changeValue: [],
    };
    const mockQuickPick = {
        title: '',
        placeholder: '',
        items: [] as vscode.QuickPickItem[],
        selectedItems: [] as vscode.QuickPickItem[],
        value: '',
        onDidAccept: jest.fn((cb: QuickPickCallback) => {
            listeners.accept.push(cb);
            return { dispose: jest.fn() };
        }),
        onDidHide: jest.fn((cb: QuickPickCallback) => {
            listeners.hide.push(cb);
            return { dispose: jest.fn() };
        }),
        onDidChangeValue: jest.fn((cb: QuickPickCallback) => {
            listeners.changeValue.push(cb);
            return { dispose: jest.fn() };
        }),
        show: jest.fn(),
        hide: jest.fn(() => {
            for (const cb of listeners.hide) {
                cb();
            }
        }),
        dispose: jest.fn(),
    };

    function simulateAccept(item?: vscode.QuickPickItem) {
        mockQuickPick.selectedItems = item ? [item] : [];
        for (const cb of listeners.accept) {
            cb();
        }
    }

    function simulateType(value: string) {
        mockQuickPick.value = value;
        for (const cb of listeners.changeValue) {
            cb(value);
        }
    }

    return { mockQuickPick, simulateAccept, simulateType };
}

const createTargetManager = () => {
    const onChangeEmitter = new vscode.EventEmitter<void>();
    const onDataUpdateEmitter = new vscode.EventEmitter<void>();
    const context = mock<vscode.ExtensionContext>({ subscriptions: [] });

    const targetTreeDataProvider: MockProxy<TargetTreeDataProvider> =
        mock<TargetTreeDataProvider>();

    const targetStore = mock<TargetStore>();
    targetStore.onChanged.mockImplementation(onChangeEmitter.event);

    const containersManager: MockProxy<ContainersManager> =
        mock<ContainersManager>();
    containersManager.getTargetState.mockResolvedValue({
        health: undefined,
        targetSsh: undefined,
    });
    containersManager.onDataUpdate.mockImplementation(
        onDataUpdateEmitter.event,
    );
    const topoCli: MockProxy<TopoCli> = mock<TopoCli>();
    targetStore.getTargets.mockReturnValue([]);
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

let statusBarItems: vscode.StatusBarItem[] = [];

const mockedStatusBarItemCreation: typeof vscode.window.createStatusBarItem = ((
    id: string,
    alignment?: vscode.StatusBarAlignment,
    priority?: number,
) => {
    const statusBarItem: vscode.StatusBarItem = {
        id,
        alignment: alignment || vscode.StatusBarAlignment.Left,
        priority,
        name: undefined,
        text: '',
        tooltip: undefined,
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        accessibilityInformation: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
    };
    statusBarItems.push(statusBarItem);
    return statusBarItem;
}) as unknown as typeof vscode.window.createStatusBarItem;

describe('TargetManager', () => {
    beforeEach(() => {
        statusBarItems = [];
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
        it('selects an SSH host from the quick pick and adds it as a target', async () => {
            const { mockQuickPick, simulateAccept } = createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue([
                'myserver',
                'dev-box',
            ]);
            targetStore.getTargets.mockReturnValue([]);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );
            simulateAccept({ label: 'myserver' });
            await commandPromise;

            expect(targetStore.addTarget).toHaveBeenCalled();
            expect(targetStore.setSelected).toHaveBeenCalledWith('myserver');
        });

        it('excludes existing targets from the quick pick items', async () => {
            const { mockQuickPick, simulateAccept } = createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue([
                'myserver',
                'dev-box',
                'existing-host',
            ]);
            targetStore.getTargets.mockReturnValue([
                { ssh: 'existing-host', host: 'existing-host' },
            ]);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );
            const labels = mockQuickPick.items.map((i) => i.label);
            expect(labels).toContain('myserver');
            expect(labels).toContain('dev-box');
            expect(labels).not.toContain('existing-host');
            expect(labels).toContain('$(gear) Configure SSH targets');

            simulateAccept({ label: 'myserver' });
            await commandPromise;
        });

        it('adds a dynamic entry when the user types a novel connection string', async () => {
            const { mockQuickPick, simulateType, simulateAccept } =
                createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );

            simulateType('root@192.0.2.1');

            const manualEntry = mockQuickPick.items.find(
                (i) => i.label === 'root@192.0.2.1',
            );
            expect(manualEntry).toBeDefined();
            expect(manualEntry!.description).toBe('Add new SSH target');

            simulateAccept(manualEntry!);
            await commandPromise;

            expect(targetStore.addTarget).toHaveBeenCalled();
            expect(targetStore.setSelected).toHaveBeenCalledWith(
                'root@192.0.2.1',
            );
        });

        it('does not add a dynamic entry when the typed value matches an existing host', async () => {
            const { mockQuickPick, simulateType, simulateAccept } =
                createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetManager, topoCli } = createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );

            simulateType('myserver');

            const items = mockQuickPick.items.filter(
                (i) => i.description === 'Add new SSH target',
            );
            expect(items).toHaveLength(0);

            simulateAccept({ label: 'myserver' });
            await commandPromise;
        });

        it('does nothing when the quick pick is dismissed', async () => {
            const { mockQuickPick } = createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );
            mockQuickPick.hide();
            await commandPromise;

            expect(targetStore.addTarget).not.toHaveBeenCalled();
        });

        it('opens SSH config in editor when "Configure SSH targets" is selected and file exists', async () => {
            const { mockQuickPick, simulateAccept } = createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            jest.mocked(fs.existsSync).mockReturnValue(true);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );
            const configItem = mockQuickPick.items.find((i) =>
                i.label.includes('Configure SSH targets'),
            );
            simulateAccept(configItem!);
            await commandPromise;

            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
                expect.objectContaining({ scheme: 'file' }),
            );
            expect(targetStore.addTarget).not.toHaveBeenCalled();
        });

        it('shows warning when "Configure SSH targets" is selected but file does not exist', async () => {
            const { mockQuickPick, simulateAccept } = createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            jest.mocked(fs.existsSync).mockReturnValue(false);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );
            const configItem = mockQuickPick.items.find((i) =>
                i.label.includes('Configure SSH targets'),
            );
            simulateAccept(configItem!);
            await commandPromise;

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('SSH config not found'),
            );
            expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
            expect(targetStore.addTarget).not.toHaveBeenCalled();
        });

        it('still shows quick pick when listCandidateTargets throws', async () => {
            const { mockQuickPick, simulateType, simulateAccept } =
                createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockImplementation(() => {
                throw new Error('no ssh config');
            });
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );

            expect(mockQuickPick.show).toHaveBeenCalled();

            simulateType('root@192.0.2.1');
            simulateAccept(
                mockQuickPick.items.find((i) => i.label === 'root@192.0.2.1')!,
            );
            await commandPromise;

            expect(targetStore.addTarget).toHaveBeenCalled();
            expect(targetStore.setSelected).toHaveBeenCalledWith(
                'root@192.0.2.1',
            );
        });

        it('shows error when targetStore.addTarget fails', async () => {
            const { mockQuickPick, simulateType, simulateAccept } =
                createMockQuickPick();
            jest.mocked(vscode.window.createQuickPick).mockReturnValue(
                mockQuickPick as unknown as vscode.QuickPick<vscode.QuickPickItem>,
            );
            const { targetTreeDataProvider, targetStore, targetManager } =
                createTargetManager();
            const error = new Error('boom');
            jest.mocked(targetStore.addTarget).mockRejectedValueOnce(error);
            await targetManager.activate();

            const commandPromise = executeCommand(
                TargetManager.addTargetCommand,
            );
            simulateType('root@192.0.2.1');
            simulateAccept(
                mockQuickPick.items.find((i) => i.label === 'root@192.0.2.1')!,
            );
            await commandPromise;

            expect(jest.mocked(targetStore.addTarget)).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to add target'),
                error,
            );
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to add target'),
            );
            expect(jest.mocked(targetStore.setSelected)).not.toHaveBeenCalled();
            expect(
                jest.mocked(targetTreeDataProvider.refresh),
            ).not.toHaveBeenCalled();
        });
    });

    describe('status bar', () => {
        it('shows an item in the status bar with the currently selected target', async () => {
            const target: TargetItem = {
                ssh: 'root@localhost',
                host: 'localhost',
            };
            const { targetManager, targetStore, containersManager } =
                createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target,
            );
            jest.mocked(
                containersManager.getTargetStateSnapshot,
            ).mockReturnValue({
                health: undefined,
                targetSsh: undefined,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.command).toBe(TargetManager.FocusViewCommand);
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target.ssh}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@localhost',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it("doesn't show an item in the status bar when no target is selected", async () => {
            const { targetManager, targetStore, containersManager } =
                createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                undefined,
            );
            jest.mocked(
                containersManager.getTargetStateSnapshot,
            ).mockReturnValue({
                health: undefined,
                targetSsh: undefined,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );

            await targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe('');
            expect(statusBarItem.tooltip).toBe(undefined);
            expect(statusBarItem.hide).toHaveBeenCalledTimes(1);
            expect(statusBarItem.show).not.toHaveBeenCalled();
        });

        it('changes the item in the status bar when the currently selected target changes', async () => {
            const target1: TargetItem = {
                ssh: 'root@localhost',
                host: 'localhost',
            };
            const target2: TargetItem = {
                ssh: 'root@other-host',
                host: 'other-host',
            };
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
                targetSsh: target1.ssh,
            });
            jest.mocked(vscode.window.createStatusBarItem).mockImplementation(
                mockedStatusBarItemCreation,
            );
            await targetManager.activate();
            jest.mocked(targetStore.getSelectedTarget).mockResolvedValue(
                target2,
            );
            jest.mocked(
                containersManager.getTargetStateSnapshot,
            ).mockReturnValue({
                health: healthyTarget,
                targetSsh: target2.ssh,
            });

            onChangeEmitter.fire();
            await waitImmediate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = statusBarItems[0];
            expect(statusBarItem.text).toBe(`$(pass-filled) ${target2.ssh}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@other-host',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(2);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });
    });
});
