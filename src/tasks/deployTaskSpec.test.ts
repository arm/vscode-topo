import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { WrappedError } from '../errors/wrappedError';
import { TOPO_DEPLOY_TASK_TYPE } from '../manifest';
import { Config } from '../services/config';
import { logger } from '../util/logger';
import { TaskExecutor } from '../util/taskExecutor';
import {
    DeployTaskSpec,
    type TopoDeployTaskDefinition,
} from './deployTaskSpec';
import { TopoTaskProvider } from './topoTaskProvider';

vi.mock('../util/logger');

describe('Topo deploy task', () => {
    const target = 'topo.local';
    const composeFile = '/projects/camera/compose.yaml';
    let config: MockProxy<Config>;
    let taskExecutor: MockProxy<TaskExecutor>;
    let taskProvider: TopoTaskProvider<TopoDeployTaskDefinition>;

    const createConfiguredTask = (configuredTarget = target): vscode.Task =>
        new vscode.Task(
            {
                type: TOPO_DEPLOY_TASK_TYPE,
                composeFile,
                target: configuredTarget,
            },
            vscode.TaskScope.Workspace,
            'Deploy camera',
            'topo',
        );

    beforeEach(() => {
        config = mock<Config>();
        config.getTargetSettings.mockReturnValue({});
        taskExecutor = mock<TaskExecutor>();
        taskExecutor.resolveProcessTaskBinary.mockImplementation(
            (task) => task,
        );
        taskProvider = new TopoTaskProvider(
            taskExecutor,
            new DeployTaskSpec(config),
        );
        vi.mocked(logger.error).mockClear();
    });

    it('resolves target settings into the deploy arguments', () => {
        const configuredTarget = 'configured.local';
        config.getTargetSettings.mockReturnValue({
            deploy: { forceRecreate: true },
        });

        const resolvedTask = taskProvider.resolveTask(
            createConfiguredTask(configuredTarget),
        );

        expect(config.getTargetSettings).toHaveBeenCalledWith(configuredTarget);
        expect(resolvedTask?.execution).toMatchObject({
            args: [
                'deploy',
                '--file',
                'compose.yaml',
                '--target',
                configuredTarget,
                '--force-recreate',
            ],
            options: { cwd: '/projects/camera' },
        });
    });

    it('handles target configuration errors', () => {
        const error = new WrappedError('CONFIG', 'Invalid target settings');
        config.getTargetSettings.mockImplementation(() => {
            throw error;
        });

        const resolvedTask = taskProvider.resolveTask(createConfiguredTask());

        expect(resolvedTask).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            `Failed to resolve ${TOPO_DEPLOY_TASK_TYPE} task`,
            error,
        );
    });

    it('does not catch unexpected target configuration errors', () => {
        const error = new Error('Failed to load target settings');
        config.getTargetSettings.mockImplementation(() => {
            throw error;
        });

        expect(() => taskProvider.resolveTask(createConfiguredTask())).toThrow(
            error,
        );
    });
});
