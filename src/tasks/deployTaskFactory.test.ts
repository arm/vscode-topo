import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { TOPO_DEPLOY_TASK_COMMAND, TOPO_TASK_TYPE } from '../manifest';
import { TopoCli } from '../services/topoCli';
import { DeployTaskFactory } from './deployTaskFactory';

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
    let taskFactory: DeployTaskFactory;

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
        taskFactory = new DeployTaskFactory(topoCli);
    });

    it('creates a deploy execution with the configured options', () => {
        const definition = taskFactory.resolveDefinition(
            createConfiguredTask({
                ...taskDefinition,
                deployOptions: { port: 5000, forceRecreate: true },
            }),
        );
        if (!definition) {
            throw new Error('Expected the deploy task definition to resolve');
        }
        const execution = taskFactory.createExecution(definition);

        expect(execution).toMatchObject({
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

    it('creates a deploy execution with CLI defaults when options are omitted', () => {
        const definition = taskFactory.resolveDefinition(
            createConfiguredTask(),
        );
        if (!definition) {
            throw new Error('Expected the deploy task definition to resolve');
        }
        const execution = taskFactory.createExecution(definition);

        expect(execution).toMatchObject({
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

        expect(taskFactory.resolveDefinition(configuredTask)).toBeUndefined();
    });
});
