import * as vscode from 'vscode';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { WrappedError } from '../errors/wrappedError';
import { TOPO_DEPLOY_TASK_COMMAND, TOPO_TASK_TYPE } from '../manifest';
import { Config } from '../services/config';
import { TopoCli } from '../services/topoCli';
import { logger } from '../util/logger';
import { DeployTaskFactory } from './deployTaskFactory';
import { TopoTaskProvider } from './topoTaskProvider';

vi.mock('../util/logger');

describe('Topo deploy task', () => {
    const target = 'topo.local';
    const composeFile = '/projects/camera/compose.yaml';
    const topoBinaryPath = '/extension/resources/topo';
    let config: MockProxy<Config>;
    let topoCli: MockProxy<TopoCli>;
    let taskProvider: TopoTaskProvider;

    const createConfiguredTask = (configuredTarget = target): vscode.Task =>
        new vscode.Task(
            {
                type: TOPO_TASK_TYPE,
                command: TOPO_DEPLOY_TASK_COMMAND,
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
        topoCli = mock<TopoCli>();
        topoCli.getBinaryPath.mockReturnValue(topoBinaryPath);
        taskProvider = new TopoTaskProvider([
            new DeployTaskFactory(config, topoCli),
        ]);
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
            process: topoBinaryPath,
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
            `Failed to resolve ${TOPO_TASK_TYPE} ${TOPO_DEPLOY_TASK_COMMAND} task`,
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
