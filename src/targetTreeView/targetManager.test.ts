import * as vscode from 'vscode';
import { TargetManager } from './targetManager';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import { TargetStore } from '../target/targetStore';
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

describe('TargetManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('activation', () => {
        it('registers tree provider on activate', async () => {
            const { targetManager, context } = createTargetManager();

            targetManager.activate();

            expect(vscode.window.createTreeView).toHaveBeenCalledWith(
                TargetManager.viewId,
                expect.anything(),
            );
            expect(context.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('status bar', () => {
        it('shows an item in the status bar with the currently selected target', async () => {
            const target = 'root@localhost';
            const { targetManager, targetStore } = createTargetManager();
            jest.mocked(targetStore.getSelectedTarget).mockReturnValue(target);

            targetManager.activate();

            expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
            const statusBarItem = jest.mocked(vscode.window.createStatusBarItem)
                .mock.results[0].value;
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
            expect(statusBarItem.command).toBe(TargetManager.focusViewCommand);
            expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
            expect(statusBarItem.tooltip).toBe(
                'Connection String: root@localhost',
            );
            expect(statusBarItem.show).toHaveBeenCalledTimes(1);
            expect(statusBarItem.hide).not.toHaveBeenCalled();
        });

        it("doesn't show an item in the status bar when no target is selected", async () => {
            const { targetManager } = createTargetManager();

            targetManager.activate();

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
            jest.mocked(targetStore.getSelectedTarget).mockReturnValue(target1);
            jest.mocked(
                containersManager.getTargetStateSnapshot,
            ).mockReturnValue({
                health: healthyTarget,
                status: 'connected',
            });
            targetManager.activate();
            jest.mocked(targetStore.getSelectedTarget).mockReturnValue(target2);
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
