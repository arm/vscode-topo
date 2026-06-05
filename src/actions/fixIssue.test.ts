import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { FixIssue } from './fixIssue';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { HealthCheckDependency } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

const mockSelectedQuickPickItem = <T extends vscode.QuickPickItem>(item: T) => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(item);
};
describe('FixIssue', () => {
    let targetModel: TargetModel;
    let topoCli: MockProxy<TopoCli>;

    const target = 'user@topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';
    const dependencies: HealthCheckDependency[] = [
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
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        targetModel = new TargetModel();
        targetModel.setSelected(target);
    });

    it('runs a single dependency fix directly', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const dependencyItem = new HealthCheckDependencyTreeItem(
            dependencies[0],
        );

        await fixIssue.fixIssueCommandHandler(dependencyItem);

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            [topoBinaryPath, 'install', 'container-engine', '--target', target],
        );
    });

    it('fails a single dependency fix without an executable command', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const dependencyItem = new HealthCheckDependencyTreeItem(
            dependencies[2],
        );

        await expect(
            fixIssue.fixIssueCommandHandler(dependencyItem),
        ).rejects.toThrow('No executable fix found for the selected item');

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails a single dependency fix when no target is selected', async () => {
        targetModel.setSelected(undefined);
        const fixIssue = new FixIssue(topoCli, targetModel);
        const dependencyItem = new HealthCheckDependencyTreeItem(
            dependencies[0],
        );

        await expect(
            fixIssue.fixIssueCommandHandler(dependencyItem),
        ).rejects.toThrow('No selected target found');

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('shows a quick pick when only one target dependency fix is available', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, true, 'connected', [
            dependencies[0],
        ]);
        mockSelectedQuickPickItem({
            label: 'Container Engine',
            description: 'Install container engine',
            detail: `Command: topo install container-engine --target ${target}`,
            dependency: dependencies[0],
            fix: dependencies[0].fix,
        });

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    dependency: dependencies[0],
                    fix: dependencies[0].fix,
                },
            ],
            {
                placeHolder: `Select a dependency fix for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            [topoBinaryPath, 'install', 'container-engine', '--target', target],
        );
    });

    it('shows target dependency fixes in a quick pick and runs the selected fix', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(
            target,
            true,
            'connected',
            dependencies,
        );
        mockSelectedQuickPickItem({
            label: 'Debugger',
            description: 'Install debugger',
            detail: `Command: topo install debugger --target ${target}`,
            dependency: dependencies[1],
            fix: dependencies[1].fix,
        });

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    dependency: dependencies[0],
                    fix: dependencies[0].fix,
                },
                {
                    label: 'Debugger',
                    description: 'Install debugger',
                    detail: `Command: topo install debugger --target ${target}`,
                    dependency: dependencies[1],
                    fix: dependencies[1].fix,
                },
            ],
            {
                placeHolder: `Select a dependency fix for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Debugger on ${target}`,
            [topoBinaryPath, 'install', 'debugger', '--target', target],
        );
    });

    it('does not run a target dependency fix when quick pick is cancelled', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(
            target,
            true,
            'connected',
            dependencies,
        );
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when the selected target dependency fix has no executable command', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, true, 'connected', [
            dependencies[0],
        ]);
        mockSelectedQuickPickItem({
            label: 'Container Engine',
            description: 'Install container engine',
            dependency: dependencies[0],
            fix: {
                description: 'Install container engine',
            },
        });

        await expect(
            fixIssue.fixIssueCommandHandler(targetItem),
        ).rejects.toThrow('No executable fix found for the selected item');

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when a target has no executable dependency fixes', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, true, 'connected', [
            dependencies[2],
        ]);

        await expect(
            fixIssue.fixIssueCommandHandler(targetItem),
        ).rejects.toThrow(
            `No executable dependency fixes found for target ${target}`,
        );

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when fixing an unselected target item', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, false, 'connected', [
            dependencies[0],
        ]);

        await expect(
            fixIssue.fixIssueCommandHandler(targetItem),
        ).rejects.toThrow(
            'Invalid target item for fix an issue: expected selected TargetTreeItem but received:',
        );

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when the command is called with an unsupported item', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);

        await expect(
            fixIssue.fixIssueCommandHandler({ unexpected: true }),
        ).rejects.toThrow(
            'Invalid item for fix issue: expected HealthCheckDependencyTreeItem or TargetTreeItem but received:',
        );
    });
});
