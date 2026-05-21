import * as vscode from 'vscode';
import { TargetStatusBarItemView } from './targetStatusBarItemView';
import { TargetTreeView } from './targetTreeView';
import { TargetStore } from '../target/targetStore';
import { ContainersManager } from '../target/containersManager';
import { mock } from 'jest-mock-extended';
import { HealthCheckResult } from '../topoCliSchema';

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

describe('TargetStatusBarItemView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows an item in the status bar with the currently selected target', async () => {
        const target = 'root@localhost';
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockReturnValue(target);
        const containersManager = mock<ContainersManager>({
            getTargetStateSnapshot: jest.fn().mockReturnValue({
                health: healthyTarget,
                status: 'disconnected',
            }),
        });
        new TargetStatusBarItemView(targetStore, containersManager);

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        const statusBarItem = jest.mocked(vscode.window.createStatusBarItem)
            .mock.results[0].value;
        expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
        expect(statusBarItem.command).toBe(TargetTreeView.focusViewCommand);
        expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
        expect(statusBarItem.tooltip).toBe('Connection String: root@localhost');
        expect(statusBarItem.show).toHaveBeenCalledTimes(1);
        expect(statusBarItem.hide).not.toHaveBeenCalled();
    });

    it("doesn't show an item in the status bar when no target is selected", async () => {
        new TargetStatusBarItemView(
            mock<TargetStore>(),
            mock<ContainersManager>(),
        );

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
        const targetStore = mock<TargetStore>();
        const onChangeEmitter = new vscode.EventEmitter<void>();
        targetStore.onChanged.mockImplementation(onChangeEmitter.event);
        const containersManager = mock<ContainersManager>({
            getTargetStateSnapshot: jest.fn().mockReturnValue({
                health: healthyTarget,
                status: 'connected',
            }),
        });

        jest.mocked(targetStore.getSelectedTarget).mockReturnValue(target1);
        new TargetStatusBarItemView(targetStore, containersManager);
        const statusBarItem = jest.mocked(vscode.window.createStatusBarItem)
            .mock.results[0].value;
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target1}`);

        jest.mocked(targetStore.getSelectedTarget).mockReturnValue(target2);
        onChangeEmitter.fire();
        await Promise.resolve();

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target2}`);
        expect(statusBarItem.show).toHaveBeenCalledTimes(2);
        expect(statusBarItem.hide).not.toHaveBeenCalled();
    });
});
