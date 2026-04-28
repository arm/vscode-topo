import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { InstallDependency } from './installDependency';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeDependencyItem } from '../workloadPlacement/targetTreeDependencyItem';
import { HealthCheckDependency } from '../topoCliSchema';
import { mutable } from '../util/mutable';

jest.mock('../util/logger');

const getCommandHandler = () => {
    const handler = jest
        .mocked(vscode.commands.registerCommand)
        .mock.calls.find(
            ([command]) =>
                command === InstallDependency.installDependencyCommand,
        )?.[1] as ((treeNode: unknown) => Promise<void>) | undefined;

    if (!handler) {
        throw new Error('No install dependency handler registered');
    }

    return handler;
};

const waitImmediate = () => {
    return new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
};

describe('InstallDependency', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    const targetStore = mock<TargetStore>();
    const target = 'user@topo.local';
    const taskExec: vscode.TaskExecution = {
        task: {} as vscode.Task,
        terminate: jest.fn(),
    };

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        targetStore.getSelectedTarget.mockResolvedValue(target);
        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExec);
        const onDidEndTaskProcessEmitter =
            new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
        setTimeout(() => {
            onDidEndTaskProcessEmitter.fire({
                execution: taskExec,
                exitCode: 0,
            });
        }, 0);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers install dependency command', () => {
        const installDependency = new InstallDependency(context, targetStore);

        installDependency.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            InstallDependency.installDependencyCommand,
            expect.any(Function),
        );
    });

    it.each(['Remoteproc Runtime', 'Remoteproc Shim'])(
        'runs install task for unhealthy %s dependency',
        async (dependencyName) => {
            const installDependency = new InstallDependency(
                context,
                targetStore,
            );
            installDependency.activate();
            const dependencyItem = new TargetTreeDependencyItem(
                mock<HealthCheckDependency>({
                    name: dependencyName,
                    status: 'error',
                    value: 'missing',
                }),
            );

            await getCommandHandler()(dependencyItem);
            await waitImmediate();

            expect(vscode.ShellExecution).toHaveBeenCalledWith('topo', [
                'install',
                'remoteproc-runtime',
                '--target',
                target,
            ]);
            expect(vscode.tasks.executeTask).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                `remoteproc-runtime was installed on target ${target}.`,
            );
        },
    );

    it('does nothing for a healthy remoteproc dependency', async () => {
        const installDependency = new InstallDependency(context, targetStore);
        installDependency.activate();
        const dependencyItem = new TargetTreeDependencyItem(
            mock<HealthCheckDependency>({
                name: 'Remoteproc Runtime',
                status: 'ok',
            }),
        );

        await getCommandHandler()(dependencyItem);

        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('shows an error when no target is selected', async () => {
        targetStore.getSelectedTarget.mockResolvedValue(undefined);
        const installDependency = new InstallDependency(context, targetStore);
        installDependency.activate();
        const dependencyItem = new TargetTreeDependencyItem(
            mock<HealthCheckDependency>({
                name: 'Remoteproc Runtime',
                status: 'error',
            }),
        );

        await getCommandHandler()(dependencyItem);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining(
                'Failed to install remoteproc-runtime. No selected target found',
            ),
        );
        expect(vscode.tasks.executeTask).not.toHaveBeenCalled();
    });

    it('shows an error when the install task fails', async () => {
        const onDidEndTaskProcessEmitter =
            new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mutable(vscode.tasks).onDidEndTaskProcess =
            onDidEndTaskProcessEmitter.event;
        jest.mocked(vscode.tasks.executeTask).mockResolvedValue(taskExec);
        const installRemoteprocRuntime = new InstallDependency(
            context,
            targetStore,
        );
        installRemoteprocRuntime.activate();
        const dependencyItem = new TargetTreeDependencyItem(
            mock<HealthCheckDependency>({
                name: 'Remoteproc Shim',
                status: 'warning',
            }),
        );

        const running = getCommandHandler()(dependencyItem);
        await waitImmediate();
        onDidEndTaskProcessEmitter.fire({
            execution: taskExec,
            exitCode: 1,
        });
        await running;

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining(
                `Failed to install remoteproc-runtime on target ${target}. install remoteproc-runtime failed with exit code 1`,
            ),
        );
    });
});
