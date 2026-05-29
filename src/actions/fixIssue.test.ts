import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { FixIssue } from './fixIssue';
import { ContainersManager } from '../target/containersManager';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { HealthCheckResult } from '../topoCliSchema';
import { TargetDescriptionStore } from '../target/targetDescriptionStore';
import { TargetDescription } from '../util/types';
import { executeCommand } from '../util/test/executeCommand';
import { TargetModel } from '../models/targetModel';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

const mockSelectedQuickPickItem = (item: unknown) => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
        item as vscode.QuickPickItem,
    );
};

describe('FixIssue', () => {
    let targetModel: TargetModel;
    let containersManager: MockProxy<ContainersManager>;
    let targetDescriptionStore: MockProxy<TargetDescriptionStore>;

    const target = 'user@topo.local';
    const targetDescription: TargetDescription = {
        hostProcessors: [],
        remoteProcessors: [],
    };
    const targetHealth: HealthCheckResult['target'] = {
        isLocalhost: false,
        dependencies: [
            {
                name: 'Container Engine',
                status: 'error',
                value: 'missing',
                fix: {
                    description: 'Install container engine',
                    command: `topo install container-engine --target ${target}`,
                },
            },
            {
                name: 'Debugger',
                status: 'warning',
                value: 'missing',
                fix: {
                    description: 'Install debugger',
                    command: `topo install debugger --target ${target}`,
                },
            },
            {
                name: 'Hardware Info',
                status: 'ok',
                value: 'lscpu',
            },
        ],
        connectivity: { name: 'Connected', status: 'ok', value: '' },
        subsystemDriver: {
            name: 'Subsystem Driver (remoteproc)',
            status: 'info',
            value: 'not configured',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        targetModel = new TargetModel();
        targetModel.setSelected(target);
        containersManager = mock<ContainersManager>();
        containersManager.getTargetState.mockResolvedValue({
            health: targetHealth,
            status: 'connected',
        });
        targetDescriptionStore = mock<TargetDescriptionStore>();
        targetDescriptionStore.getDescription.mockResolvedValue(
            targetDescription,
        );
    });

    const createFixIssue = () =>
        new FixIssue(targetModel, containersManager, targetDescriptionStore);

    it('registers fix issue commands', () => {
        createFixIssue();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            FixIssue.fixDependencyIssueCommand,
            expect.any(Function),
        );
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            FixIssue.fixTargetIssuesCommand,
            expect.any(Function),
        );
    });

    it('runs a single dependency fix directly', async () => {
        createFixIssue();
        const dependencyItem = new HealthCheckDependencyTreeItem(
            targetHealth.dependencies[0],
        );

        await executeCommand(
            FixIssue.fixDependencyIssueCommand,
            dependencyItem,
        );

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            ['topo', 'install', 'container-engine', '--target', target],
        );
    });

    it('does not run a single dependency fix without an executable command', async () => {
        createFixIssue();
        const dependencyItem = new HealthCheckDependencyTreeItem(
            targetHealth.dependencies[2],
        );

        await executeCommand(
            FixIssue.fixDependencyIssueCommand,
            dependencyItem,
        );

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows a quick pick when only one target dependency fix is available', async () => {
        containersManager.getTargetState.mockResolvedValue({
            health: {
                ...targetHealth,
                dependencies: [targetHealth.dependencies[0]],
            },
            status: 'connected',
        });
        createFixIssue();
        const targetItem = new TargetTreeItem(target, true, 'connected');
        mockSelectedQuickPickItem({
            label: 'Container Engine',
            description: 'Install container engine',
            detail: `Command: topo install container-engine --target ${target}`,
            dependency: targetHealth.dependencies[0],
            fix: targetHealth.dependencies[0].fix,
        });

        await executeCommand(FixIssue.fixTargetIssuesCommand, targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    dependency: targetHealth.dependencies[0],
                    fix: targetHealth.dependencies[0].fix,
                },
            ],
            {
                placeHolder: `Select a dependency fix for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            ['topo', 'install', 'container-engine', '--target', target],
        );
    });

    it('shows target dependency fixes in a quick pick and runs the selected fix', async () => {
        createFixIssue();
        const targetItem = new TargetTreeItem(target, true, 'connected');
        mockSelectedQuickPickItem({
            label: 'Debugger',
            description: 'Install debugger',
            detail: `Command: topo install debugger --target ${target}`,
            dependency: targetHealth.dependencies[1],
            fix: targetHealth.dependencies[1].fix,
        });

        await executeCommand(FixIssue.fixTargetIssuesCommand, targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    dependency: targetHealth.dependencies[0],
                    fix: targetHealth.dependencies[0].fix,
                },
                {
                    label: 'Debugger',
                    description: 'Install debugger',
                    detail: `Command: topo install debugger --target ${target}`,
                    dependency: targetHealth.dependencies[1],
                    fix: targetHealth.dependencies[1].fix,
                },
            ],
            {
                placeHolder: `Select a dependency fix for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Debugger on ${target}`,
            ['topo', 'install', 'debugger', '--target', target],
        );
    });

    it('ignores subsystem driver fixes when the target has no remote processors', async () => {
        containersManager.getTargetState.mockResolvedValue({
            health: {
                ...targetHealth,
                dependencies: [],
                subsystemDriver: {
                    name: 'Subsystem Driver (remoteproc)',
                    status: 'error',
                    value: 'missing',
                    fix: {
                        description: 'Install subsystem driver',
                        command: `topo install subsystem-driver --target ${target}`,
                    },
                },
            },
            status: 'connected',
        });
        createFixIssue();
        const targetItem = new TargetTreeItem(target, true, 'connected');

        await executeCommand(FixIssue.fixTargetIssuesCommand, targetItem);

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('does not run a target dependency fix when quick pick is cancelled', async () => {
        createFixIssue();
        const targetItem = new TargetTreeItem(target, true, 'connected');
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await executeCommand(FixIssue.fixTargetIssuesCommand, targetItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });
});
