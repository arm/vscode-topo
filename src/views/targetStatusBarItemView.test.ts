import * as vscode from 'vscode';
import { TargetStatusBarItemView } from './targetStatusBarItemView';
import { TargetTreeView } from './targetTreeView';
import { mock } from 'vitest-mock-extended';
import { TargetHealthCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { loaded, loading, unloaded } from '../util/loadable';
import { selectTarget } from '../commands';

vi.mock('../util/logger');

const healthyTarget: TargetHealthCheck = {
    destination: 'ssh://root@localhost',
    isLocalhost: false,
    connectivity: {
        status: 'ok',
        name: 'Connectivity',
        value: '',
    },
    dependencies: [{ status: 'ok', name: 'Container Engine', value: '' }],
    processingDomainDriver: {
        status: 'ok',
        name: 'Processing Domain Driver',
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
        targetModel.setSelectedTargetHealth(loaded(healthyTarget));

        new TargetStatusBarItemView(targetModel);

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target}`);
        expect(statusBarItem.command).toBe(TargetTreeView.focusViewCommand);
        expect(statusBarItem.tooltip).toBe('SSH destination: root@localhost');
        expect(statusBarItem.show).toHaveBeenCalledTimes(1);
        expect(statusBarItem.hide).not.toHaveBeenCalled();
    });

    it('shows a loading icon in the status bar when the health of the selected target is loading', async () => {
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loading(loaded(healthyTarget)));

        new TargetStatusBarItemView(targetModel);

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(loading~spin) ${target}`);
    });

    it('shows a neutral target icon when selected target health is unloaded', async () => {
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(unloaded());

        new TargetStatusBarItemView(targetModel);

        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(target) ${target}`);
    });

    it('shows a select target item in the status bar when no target is selected', async () => {
        new TargetStatusBarItemView(new TargetModel());

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe('$(target) Select a target');
        expect(statusBarItem.tooltip).toBe('Select a target');
        expect(statusBarItem.command).toBe(selectTarget);
        expect(statusBarItem.show).toHaveBeenCalledTimes(1);
        expect(statusBarItem.hide).not.toHaveBeenCalled();
    });

    it('changes the item in the status bar when the currently selected target changes', async () => {
        const target1 = 'root@localhost';
        const target2 = 'root@other-host';
        const targetModel = new TargetModel();

        targetModel.setSelected(target1);
        targetModel.setSelectedTargetHealth(loaded(healthyTarget));
        new TargetStatusBarItemView(targetModel);
        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target1}`);

        targetModel.setSelected(target2);
        targetModel.setSelectedTargetHealth(loaded(healthyTarget));

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(1);
        expect(statusBarItem.text).toBe(`$(pass-filled) ${target2}`);
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
        targetModel.setSelectedTargetHealth(
            loaded({
                ...healthyTarget,
                dependencies: [
                    {
                        status: 'warning',
                        name: 'Container Engine',
                        value: 'missing',
                    },
                ],
            }),
        );

        new TargetStatusBarItemView(targetModel);

        expect(statusBarItem.text).toBe(`$(warning) ${target}`);
        expect(statusBarItem.tooltip).toBe('SSH destination: root@localhost');
    });
});
