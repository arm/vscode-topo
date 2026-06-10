import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { FixIssue } from './fixIssue';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { loaded } from '../util/loadable';
import { HealthCheckDependencyTreeItem } from '../treeItems/healthCheckDependencyTreeItem';
import { executeTask } from '../util/executeTask';
import { IssueCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

vi.mock('../util/logger');
vi.mock('../util/executeTask');

const executeTaskMock = vi.mocked(executeTask);

type ShowQuickPickMany = <T extends vscode.QuickPickItem>(
    items: T[],
    options: vscode.QuickPickOptions & { canPickMany: true },
) => Thenable<T[] | undefined>;

const mockSelectedQuickPickItems = <T extends vscode.QuickPickItem>(
    items: T[] | undefined,
) => {
    const showQuickPickMock = vi.mocked<ShowQuickPickMany>(
        vscode.window.showQuickPick,
    );
    showQuickPickMock.mockResolvedValueOnce(items);
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
    const connectedIssue: IssueCheck = {
        name: 'Connectivity',
        status: 'ok',
        value: 'ok',
    };

    const createTargetItemWithIssues = (
        targetIssues: IssueCheck[],
        selected = true,
        connectivity: IssueCheck = connectedIssue,
    ): TargetTreeItem =>
        new TargetTreeItem({
            target,
            selected,
            health: loaded({
                destination: `ssh://${target}`,
                isLocalhost: false,
                connectivity,
                dependencies: targetIssues,
                subsystemDriver: {
                    name: 'SubsystemDriver',
                    status: 'ok',
                    value: 'ready',
                },
            }),
        });

    beforeEach(() => {
        vi.clearAllMocks();
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        topoCli.resolveTopoCommand.mockImplementation((command) => {
            const commandArgs = command.split(/\s+/);
            if (commandArgs[0] === 'topo') {
                commandArgs[0] = topoBinaryPath;
            }
            return commandArgs;
        });
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
        const targetItem = createTargetItemWithIssues([dependencies[0]]);
        mockSelectedQuickPickItems([
            {
                label: 'Container Engine',
                description: 'Install container engine',
                detail: `Command: topo install container-engine --target ${target}`,
                issue: dependencies[0],
            },
        ]);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    issue: dependencies[0],
                },
            ],
            {
                canPickMany: true,
                placeHolder: `Select fixes for ${target}`,
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
        const targetItem = createTargetItemWithIssues(
            [],
            true,
            connectivityIssue,
        );
        mockSelectedQuickPickItems([
            {
                label: 'Connectivity',
                description: 'Configure ssh keys',
                detail: 'Command: topo setup-keys --target ssh://pi5-rod',
                issue: connectivityIssue,
            },
        ]);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Connectivity on ${target}`,
            [topoBinaryPath, 'setup-keys', '--target', 'ssh://pi5-rod'],
        );
    });

    it('shows target issue fixes in a quick pick and runs the selected fix', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = createTargetItemWithIssues(dependencies);
        mockSelectedQuickPickItems([
            {
                label: 'Debugger',
                description: 'Install debugger',
                detail: `Command: topo install debugger --target ${target}`,
                issue: dependencies[1],
            },
        ]);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                {
                    label: 'Container Engine',
                    description: 'Install container engine',
                    detail: `Command: topo install container-engine --target ${target}`,
                    issue: dependencies[0],
                },
                {
                    label: 'Debugger',
                    description: 'Install debugger',
                    detail: `Command: topo install debugger --target ${target}`,
                    issue: dependencies[1],
                },
            ],
            {
                canPickMany: true,
                placeHolder: `Select fixes for ${target}`,
            },
        );
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Debugger on ${target}`,
            [topoBinaryPath, 'install', 'debugger', '--target', target],
        );
    });

    it('runs each selected target dependency fix', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = createTargetItemWithIssues(dependencies);
        mockSelectedQuickPickItems([
            {
                label: 'Container Engine',
                description: 'Install container engine',
                detail: `Command: topo install container-engine --target ${target}`,
                issue: dependencies[0],
            },
            {
                label: 'Debugger',
                description: 'Install debugger',
                detail: `Command: topo install debugger --target ${target}`,
                issue: dependencies[1],
            },
        ]);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).toHaveBeenNthCalledWith(
            1,
            `Fix Container Engine on ${target}`,
            [topoBinaryPath, 'install', 'container-engine', '--target', target],
        );
        expect(executeTaskMock).toHaveBeenNthCalledWith(
            2,
            `Fix Debugger on ${target}`,
            [topoBinaryPath, 'install', 'debugger', '--target', target],
        );
    });

    it('runs a shared target dependency fix only once', async () => {
        const sharedCommand = `topo install remoteproc --target ${target}`;
        const remoteprocRuntime: IssueCheck = {
            name: 'Remoteproc Runtime',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install remoteproc components',
                command: sharedCommand,
            },
        };
        const remoteprocShim: IssueCheck = {
            name: 'Remoteproc Shim',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install remoteproc components',
                command: sharedCommand,
            },
        };
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = createTargetItemWithIssues([
            remoteprocRuntime,
            remoteprocShim,
        ]);
        mockSelectedQuickPickItems([
            {
                label: 'Remoteproc Runtime',
                description: 'Install remoteproc components',
                detail: `Command: ${sharedCommand}`,
                issue: remoteprocRuntime,
            },
            {
                label: 'Remoteproc Shim',
                description: 'Install remoteproc components',
                detail: `Command: ${sharedCommand}`,
                issue: remoteprocShim,
            },
        ]);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).toHaveBeenCalledTimes(1);
        expect(executeTaskMock).toHaveBeenCalledWith(
            `Fix Remoteproc Runtime, Remoteproc Shim on ${target}`,
            [topoBinaryPath, 'install', 'remoteproc', '--target', target],
        );
    });

    it('does not run a target dependency fix when quick pick is cancelled', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = createTargetItemWithIssues(dependencies);
        mockSelectedQuickPickItems([]);

        await fixIssue.fixIssueCommandHandler(targetItem);

        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when a target has no executable dependency fixes', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);
        const targetItem = createTargetItemWithIssues([dependencies[2]]);

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
        const targetItem = createTargetItemWithIssues([dependencies[0]], false);

        await expect(
            fixIssue.fixIssueCommandHandler(targetItem),
        ).rejects.toThrow(
            'Invalid target item for fix issues: expected selected TargetTreeItem but received:',
        );

        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
        expect(executeTaskMock).not.toHaveBeenCalled();
    });

    it('fails when the command is called with an unsupported item', async () => {
        const fixIssue = new FixIssue(topoCli, targetModel);

        await expect(
            fixIssue.fixIssueCommandHandler({ unexpected: true }),
        ).rejects.toThrow(
            'Invalid item for fix issues: expected HealthCheckDependencyTreeItem or TargetTreeItem but received:',
        );
    });
});
