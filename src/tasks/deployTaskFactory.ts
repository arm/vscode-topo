import * as vscode from 'vscode';
import { TOPO_DEPLOY_TASK_COMMAND, TOPO_TASK_TYPE } from '../manifest';
import type { TopoCli } from '../services/topoCli';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import { createTask } from '../util/task';
import { isDeployOptions, type DeployOptions } from '../util/targetSettings';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import type { TopoTaskDefinition, TopoTaskFactory } from './topoTaskProvider';

export type TopoDeployTaskDefinition = TopoComposeTaskDefinition &
    TopoTaskDefinition & {
        readonly command: typeof TOPO_DEPLOY_TASK_COMMAND;
        readonly deployOptions: DeployOptions;
    };

const createArgs = (definition: TopoDeployTaskDefinition): string[] => {
    const { target, deployOptions } = definition;
    const args = ['deploy', '--file', COMPOSE_FILE_NAME, '--target', target];
    if (deployOptions.port !== undefined) {
        args.push('-p', String(deployOptions.port));
    }
    if (deployOptions.forceRecreate) {
        args.push('--force-recreate');
    }
    if (deployOptions.noRecreate) {
        args.push('--no-recreate');
    }
    return args;
};

export class DeployTaskFactory implements TopoTaskFactory<TopoDeployTaskDefinition> {
    public readonly command = TOPO_DEPLOY_TASK_COMMAND;

    constructor(private readonly topoCli: TopoCli) {}

    public resolveDefinition(
        task: vscode.Task,
    ): TopoDeployTaskDefinition | undefined {
        const definition = resolveTopoComposeTaskDefinition(task);
        if (!definition) {
            return undefined;
        }

        const deployOptions = definition.deployOptions ?? {};
        if (!isDeployOptions(deployOptions)) {
            return undefined;
        }

        return {
            ...definition,
            type: TOPO_TASK_TYPE,
            command: TOPO_DEPLOY_TASK_COMMAND,
            deployOptions,
        };
    }

    public createExecution(
        definition: TopoDeployTaskDefinition,
    ): vscode.ProcessExecution {
        return new vscode.ProcessExecution(
            this.topoCli.getBinaryPath(),
            createArgs(definition),
            { cwd: createTopoComposeTaskCwd(definition) },
        );
    }

    public createTask(definition: TopoDeployTaskDefinition): vscode.Task {
        const execution = this.createExecution(definition);
        return createTask(
            `Deploy ${definition.composeFile} to ${definition.target}`,
            execution,
            { cwd: execution.options?.cwd, definition },
        );
    }
}
