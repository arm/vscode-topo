import * as vscode from 'vscode';
import { TargetStatusBarItemView } from './targetStatusBarItemView';
import { TargetTreeView } from './targetTreeView';
import { ContainersManager } from '../target/containersManager';
import { mock } from 'vitest-mock-extended';
import { TargetHealthCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/logger');

const healthyTarget: TargetHealthCheck = {
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
        vi.clearAllMocks();
    });

    it('shows an item in the status bar with the currently selected target', async () => {
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const containersManager = mock<ContainersManager>({
            getTargetStateSnapshot: vi.fn().mockReturnValue({
                health: healthyTarget,
                status: 'disconnected',
            }),
        });
        new TargetStatusBarItemView(targetModel, containersManager);

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
        expect(statusBarItem.command).toBe(TargetTreeView.focusViewCommand);
        expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
        expect(statusBarItem.tooltip).toBe('Connection String: root@localhost');
        expect(statusBarItem.show).toHaveBeenCalledTimes(1);
        expect(statusBarItem.hide).not.toHaveBeenCalled();
    });

    it("doesn't show an item in the status bar when no target is selected", async () => {
        new TargetStatusBarItemView(
            new TargetModel(),
            mock<ContainersManager>(),
        );

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(undefined);
        expect(statusBarItem.tooltip).toBe(undefined);
        expect(statusBarItem.hide).toHaveBeenCalledTimes(1);
        expect(statusBarItem.show).not.toHaveBeenCalled();
    });

    it('changes the item in the status bar when the currently selected target changes', async () => {
        const target1 = 'root@localhost';
        const target2 = 'root@other-host';
        const targetModel = new TargetModel();
        const containersManager = mock<ContainersManager>({
            getTargetStateSnapshot: vi.fn().mockReturnValue({
                health: healthyTarget,
                status: 'connected',
            }),
        });

        targetModel.setSelected(target1);
        new TargetStatusBarItemView(targetModel, containersManager);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target1}`);

        targetModel.setSelected(target2);

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target2}`);
        expect(statusBarItem.show).toHaveBeenCalledTimes(2);
        expect(statusBarItem.hide).not.toHaveBeenCalled();
    });

    it('shows unhealthy target dependencies with an icon only', async () => {
        const statusBarItem = mock<vscode.StatusBarItem>();
        vi.mocked(vscode.window).createStatusBarItem.mockReturnValue(
            statusBarItem,
        );
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        const containersManager = mock<ContainersManager>({
            getTargetStateSnapshot: vi.fn().mockReturnValue({
                health: {
                    ...healthyTarget,
                    dependencies: [
                        {
                            status: 'warning',
                            name: 'Container Engine',
                            value: 'missing',
                        },
                    ],
                },
                status: 'connected',
            }),
        });

        new TargetStatusBarItemView(targetModel, containersManager);

        expect(statusBarItem.text).toBe(`$(warning) ${target}`);
        expect(statusBarItem.tooltip).toBe('Connection String: root@localhost');
    });
});
