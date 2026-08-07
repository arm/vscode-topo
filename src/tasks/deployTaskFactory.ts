import * as vscode from 'vscode';
import { isWrappedError } from '../errors/wrappedError';
import { TOPO_DEPLOY_TASK_TYPE } from '../manifest';
import type { Config } from '../services/config';
import type { TopoCli } from '../services/topoCli';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import { logger } from '../util/logger';
import { createTask } from '../util/task';
import type { TargetDeploySettings } from '../util/targetSettings';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import type { TopoTaskFactory } from './topoTaskProvider';

export interface TopoDeployTaskDefinition extends TopoComposeTaskDefinition {
    readonly type: typeof TOPO_DEPLOY_TASK_TYPE;
    readonly settings: TargetDeploySettings;
}

export class DeployTaskFactory implements TopoTaskFactory<TopoDeployTaskDefinition> {
    public readonly type = TOPO_DEPLOY_TASK_TYPE;

    constructor(
        private readonly config: Config,
        private readonly topoCli: TopoCli,
    ) {}

    public resolveDefinition(
        task: vscode.Task,
    ): TopoDeployTaskDefinition | undefined {
        const definition = resolveTopoComposeTaskDefinition(task);
        if (!definition) {
            return undefined;
        }

        let settings: TargetDeploySettings;
        try {
            settings =
                this.config.getTargetSettings(definition.target).deploy ?? {};
        } catch (error) {
            if (!isWrappedError(error, ['CONFIG'])) {
                throw error;
            }
            logger.error(`Failed to resolve ${definition.type} task`, error);
            return undefined;
        }

        return {
            ...definition,
            type: TOPO_DEPLOY_TASK_TYPE,
            settings,
        };
    }

    public createExecution(
        definition: TopoDeployTaskDefinition,
    ): vscode.ProcessExecution {
        return new vscode.ProcessExecution(
            this.topoCli.getBinaryPath(),
            this.createArgs(definition),
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

    private createArgs(definition: TopoDeployTaskDefinition): string[] {
        const { target, settings } = definition;
        const args = [
            'deploy',
            '--file',
            COMPOSE_FILE_NAME,
            '--target',
            target,
        ];
        if (settings.port !== undefined) {
            args.push('-p', String(settings.port));
        }
        if (settings.forceRecreate) {
            args.push('--force-recreate');
        }
        if (settings.noRecreate) {
            args.push('--no-recreate');
        }
        return args;
    }
}
