import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import type { TargetDeploySettings } from '../util/targetSettings';
import {
    createTopoComposeTask,
    type TopoComposeTaskDefinition,
} from './topoComposeTask';

export const TOPO_DEPLOY_TASK_TYPE = `${PACKAGE_NAME}.deploy`;

export interface TopoDeployTaskDefinition extends TopoComposeTaskDefinition {
    readonly type: typeof TOPO_DEPLOY_TASK_TYPE;
    readonly settings: TargetDeploySettings;
}

const taskSpec = {
    createTaskName: (composeFilePath: string, target: string): string =>
        `Deploy ${composeFilePath} to ${target}`,
    createArgs: (definition: TopoDeployTaskDefinition): string[] => {
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
    },
};

export class TopoDeployTaskProvider {
    public createTask(definition: TopoDeployTaskDefinition): vscode.Task {
        return createTopoComposeTask(taskSpec, definition);
    }
}
