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
    topoCli.listCandidateTargets.mockReturnValue([]);
    const targetManager = new TargetManager(
        context,
        targetTreeDataProvider,
        targetStore,
        containersManager,
        topoCli,
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
        it('handles addTargetCommand: prompts for ssh, stores and selects new target', async () => {
            const targetSsh = 'root@192.0.2.1';
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                targetSsh,
            );
            const { targetStore, targetManager } = createTargetManager();

            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(
                jest.mocked(targetStore.addTarget).mock.calls.length,
            ).toBeGreaterThanOrEqual(1);
            const created = jest.mocked(targetStore.addTarget).mock.calls[0][0];
            expect(created).toBeDefined();
            expect(targetStore.setSelected).toHaveBeenCalledWith(targetSsh);
        });

        it('does nothing when ssh input is cancelled', async () => {
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                undefined,
            );
            const { targetStore, targetManager } = createTargetManager();
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
            expect(targetStore.setSelected).not.toHaveBeenCalled();
        });

        it('shows SSH hosts from config as quick pick items, excluding existing targets', async () => {
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
            jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({
                label: 'myserver',
            });
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            const quickPickItems = jest.mocked(vscode.window.showQuickPick).mock
                .calls[0][0] as vscode.QuickPickItem[];
            const labels = quickPickItems.map((item) => item.label);
            expect(labels).toContain('myserver');
            expect(labels).toContain('dev-box');
            expect(labels).not.toContain('existing-host');
            expect(labels).toContain('$(gear) Configure SSH targets');
            expect(targetStore.addTarget).toHaveBeenCalled();
            expect(targetStore.setSelected).toHaveBeenCalledWith('myserver');
        });

        it('opens SSH config in editor when "Configure SSH targets" is selected and file exists', async () => {
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            jest.mocked(fs.existsSync).mockReturnValue(true);
            jest.mocked(vscode.window.showQuickPick).mockImplementation(
                async (items) => {
                    const arr = items as vscode.QuickPickItem[];
                    return arr.find((i) =>
                        i.label.includes('Configure SSH targets'),
                    );
                },
            );
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
                expect.objectContaining({ scheme: 'file' }),
            );
            expect(targetStore.addTarget).not.toHaveBeenCalled();
        });

        it('shows warning when "Configure SSH targets" is selected but file does not exist', async () => {
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            jest.mocked(fs.existsSync).mockReturnValue(false);
            jest.mocked(vscode.window.showQuickPick).mockImplementation(
                async (items) => {
                    const arr = items as vscode.QuickPickItem[];
                    return arr.find((i) =>
                        i.label.includes('Configure SSH targets'),
                    );
                },
            );
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('SSH config not found'),
            );
            expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
            expect(targetStore.addTarget).not.toHaveBeenCalled();
        });

        it('does nothing when quick pick is cancelled', async () => {
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockReturnValue(['myserver']);
            targetStore.getTargets.mockReturnValue([]);
            jest.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
                undefined,
            );
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(targetStore.addTarget).not.toHaveBeenCalled();
        });

        it('falls back to input box when listCandidateTargets throws', async () => {
            const { targetStore, targetManager, topoCli } =
                createTargetManager();
            topoCli.listCandidateTargets.mockImplementation(() => {
                throw new Error('no ssh config');
            });
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'root@192.0.2.1',
            );
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

            expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
            expect(vscode.window.showInputBox).toHaveBeenCalled();
            expect(targetStore.addTarget).toHaveBeenCalled();
        });

        it('shows error when targetStore.addTarget fails', async () => {
            jest.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
                'root@192.0.2.1',
            );
            const { targetTreeDataProvider, targetStore, targetManager } =
                createTargetManager();
            const error = new Error('boom');
            jest.mocked(targetStore.addTarget).mockRejectedValueOnce(error);
            await targetManager.activate();

            await executeCommand(TargetManager.addTargetCommand);

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
