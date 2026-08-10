import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TOPO_DEPLOY_TASK_COMMAND, TOPO_TASK_TYPE } from '../manifest';
import { TopoCli } from '../services/topoCli';
import { DeployTaskFactory } from './deployTaskFactory';
import { TaskProvider } from './taskProvider';

describe('Topo deploy task', () => {
    const target = 'topo.local';
    const composeFile = '/projects/camera/compose.yaml';
    const topoBinaryPath = '/extension/resources/topo';
    const taskDefinition: vscode.TaskDefinition = {
        type: TOPO_TASK_TYPE,
        command: TOPO_DEPLOY_TASK_COMMAND,
        composeFile,
        target,
    };
    let topoCli: MockProxy<TopoCli>;
    let taskProvider: TaskProvider;

    const createConfiguredTask = (
        definition: vscode.TaskDefinition = taskDefinition,
    ): vscode.Task =>
        new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            'Deploy camera',
            'topo',
        );

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        taskProvider = new TaskProvider([new DeployTaskFactory(topoCli)]);
    });

    it('resolves task deploy options into the deploy arguments', () => {
        const resolvedTask = taskProvider.resolveTask(
            createConfiguredTask({
                ...taskDefinition,
                deployOptions: { port: 5000, forceRecreate: true },
            }),
        );

        expect(resolvedTask?.execution).toMatchObject({
            process: topoBinaryPath,
            args: [
                'deploy',
                '--file',
                'compose.yaml',
                '--target',
                target,
                '-p',
                '5000',
                '--force-recreate',
            ],
            options: { cwd: '/projects/camera' },
        });
    });

    it('uses CLI defaults when deploy options are omitted', () => {
        const resolvedTask = taskProvider.resolveTask(createConfiguredTask());

        expect(resolvedTask?.execution).toMatchObject({
            args: ['deploy', '--file', 'compose.yaml', '--target', target],
        });
    });

    it('does not resolve invalid deploy options', () => {
        const configuredTask = createConfiguredTask({
            ...taskDefinition,
            deployOptions: {
                forceRecreate: true,
                noRecreate: true,
            },
        });

        expect(taskProvider.resolveTask(configuredTask)).toBeUndefined();
    });
});
