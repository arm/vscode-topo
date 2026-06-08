import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { FixIssue } from './fixIssue';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { IssueCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

const mockSelectedQuickPickItem = <T extends vscode.QuickPickItem>(
    item: T | undefined,
) => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(item);
};

describe('FixIssue', () => {
    let targetModel: TargetModel;
    let topoCli: MockProxy<TopoCli>;

    const target = 'user@topo.local';
    const topoBinaryPath = '/fake/extension/resources/topo';
    const dependencies: IssueCheck[] = [
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

    it('shows a quick pick when only one target issue fix is available', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, true, 'connected', [
            dependencies[0],
        ]);
        mockSelectedQuickPickItem({
            label: 'Container Engine',
            description: 'Install container engine',
            detail: `Command: topo install container-engine --target ${target}`,
            name: dependencies[0].name,
            status: dependencies[0].status,
            value: dependencies[0].value,
            fix: dependencies[0].fix,
        });

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    name: dependencies[0].name,
                    status: dependencies[0].status,
                    value: dependencies[0].value,
                    fix: dependencies[0].fix,
                },
            ],
            {
                placeHolder: `Select an issue fix for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Container Engine on ${target}`,
            [topoBinaryPath, 'install', 'container-engine', '--target', target],
        );
    });

    it('runs fix task for target connectivity issue', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const connectivityIssue: IssueCheck = {
            name: 'Connectivity',
            status: 'error',
            value: 'ssh authentication failed',
            fix: {
                description: 'Configure ssh keys',
                command: 'topo setup-keys --target ssh://pi5-rod',
            },
        };
        const targetItem = new TargetTreeItem(
            target,
            true,
            'error',
            [],
            [],
            connectivityIssue,
        );
        mockSelectedQuickPickItem({
            label: 'Connectivity',
            description: 'Configure ssh keys',
            detail: 'Command: topo setup-keys --target ssh://pi5-rod',
            name: 'Connectivity',
            status: 'error',
            value: 'ssh authentication failed',
            fix: {
                description: 'Configure ssh keys',
                command: 'topo setup-keys --target ssh://pi5-rod',
            },
        });

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Connectivity on ${target}`,
            [topoBinaryPath, 'setup-keys', '--target', 'ssh://pi5-rod'],
        );
    });

    it('shows target issue fixes in a quick pick and runs the selected fix', async () => {
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
            name: dependencies[1].name,
            status: dependencies[1].status,
            value: dependencies[1].value,
            fix: dependencies[1].fix,
        });

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    name: dependencies[0].name,
                    status: dependencies[0].status,
                    value: dependencies[0].value,
                    fix: dependencies[0].fix,
                },
                {
                    label: 'Debugger',
                    description: 'Install debugger',
                    detail: `Command: topo install debugger --target ${target}`,
                    name: dependencies[1].name,
                    status: dependencies[1].status,
                    value: dependencies[1].value,
                    fix: dependencies[1].fix,
                },
            ],
            {
                placeHolder: `Select an issue fix for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Debugger on ${target}`,
            [topoBinaryPath, 'install', 'debugger', '--target', target],
        );
    });

    it('does not run a target issue fix when quick pick is cancelled', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(
            target,
            true,
            'connected',
            dependencies,
        );
        mockSelectedQuickPickItem(undefined);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when a target has no executable issue fixes', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, true, 'connected', [
            dependencies[2],
        ]);

        await expect(
            fixIssue.fixIssueCommandHandler(targetItem),
        ).rejects.toThrow(
            `No executable issue fixes found for target ${target}`,
        );

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when fixing an unselected target item', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = new TargetTreeItem(target, false, 'connected');

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
