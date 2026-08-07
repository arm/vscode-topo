import * as vscode from 'vscode';
import { isWrappedError } from '../errors/wrappedError';
import { TOPO_DEPLOY_TASK_TYPE } from '../manifest';
import type { Config } from '../services/config';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import { logger } from '../util/logger';
import type { TargetDeploySettings } from '../util/targetSettings';
import {
    createTopoComposeTaskCwd,
    resolveTopoComposeTaskDefinition,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';
import type { TopoTaskSpec } from './topoTaskProvider';

export interface TopoDeployTaskDefinition extends TopoComposeTaskDefinition {
    readonly type: typeof TOPO_DEPLOY_TASK_TYPE;
    readonly settings: TargetDeploySettings;
}

export class DeployTaskSpec implements TopoTaskSpec<TopoDeployTaskDefinition> {
    public readonly type = TOPO_DEPLOY_TASK_TYPE;

    constructor(private readonly config: Config) {}

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

    public createArgs(definition: TopoDeployTaskDefinition): string[] {
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

    public createCwd(definition: TopoDeployTaskDefinition): string {
        return createTopoComposeTaskCwd(definition);
    }

    public createTaskName(definition: TopoDeployTaskDefinition): string {
        return `Deploy ${definition.composeFile} to ${definition.target}`;
    }
}
