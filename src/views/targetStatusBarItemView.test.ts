import * as vscode from 'vscode';
import { TargetStatusBarItemView } from './targetStatusBarItemView';
import { TargetTreeView } from './targetTreeView';
import { mock } from 'vitest-mock-extended';
import { HealthCheck } from '../services/topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { errored, loaded, loading, unloaded } from '../util/loadable';
import { selectTarget } from '../commandIds';

vi.mock('../util/logger');

const healthyTarget: HealthCheck[] = [
    {
        status: 'ok',
        name: 'Connectivity',
        location: 'target',
        value: '',
    },
];

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

    it('shows an error icon when selected target health failed to load', async () => {
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(errored('ssh connection failed'));

        new TargetStatusBarItemView(targetModel);

        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(error) ${target}`);
        expect(statusBarItem.tooltip).toBe(
            'SSH destination: root@localhost\nTarget health: ssh connection failed',
        );
    });

    it('shows an error icon when selected target connectivity is unhealthy', async () => {
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(
            loaded([
                {
                    name: 'Connectivity',
                    location: 'target',
                    status: 'error',
                    value: 'ssh connection failed',
                },
            ]),
        );

        new TargetStatusBarItemView(targetModel);

        const statusBarItem = vi.mocked(vscode.window.createStatusBarItem).mock
            .results[0].value;
        expect(statusBarItem.text).toBe(`$(error) ${target}`);
        expect(statusBarItem.tooltip).toBe(
            'SSH destination: root@localhost\nConnectivity: ssh connection failed',
        );
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

    it('lists unhealthy checks in the status bar tooltip', () => {
        const statusBarItem = mock<vscode.StatusBarItem>();
        vi.mocked(vscode.window).createStatusBarItem.mockReturnValue(
            statusBarItem,
        );
        const target = 'root@localhost';
        const targetModel = new TargetModel();
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(
            loaded([
                {
                    status: 'ok',
                    name: 'Connectivity',
                    location: 'target',
                    value: '',
                },
                {
                    status: 'warning',
                    name: 'Container Engine',
                    location: 'target',
                    value: 'missing',
                },
                {
                    status: 'error',
                    name: 'Container Runtime',
                    location: 'target',
                    value: 'not running',
                },
                {
                    status: 'undetermined',
                    name: 'Processing Domain Driver (remoteproc)',
                    location: 'target',
                    value: 'not checked: prerequisite failed',
                },
            ]),
        );

        new TargetStatusBarItemView(targetModel);

        expect(statusBarItem.text).toBe(`$(close) ${target}`);
        expect(statusBarItem.tooltip).toBe(
            'SSH destination: root@localhost\nContainer Engine: missing\nContainer Runtime: not running\nProcessing Domain Driver (remoteproc): not checked: prerequisite failed',
        );
    });
});
