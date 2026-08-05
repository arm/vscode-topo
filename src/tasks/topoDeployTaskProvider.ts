import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import type { TargetDeploySettings } from '../util/targetSettings';
import {
    createTopoComposeTask,
    type TopoComposeTaskInvocation,
} from './topoComposeTask';

export interface TopoDeployTaskInvocation extends TopoComposeTaskInvocation {
    settings: TargetDeploySettings;
}

const taskType = `${PACKAGE_NAME}.deploy`;
const taskSpec = {
    type: taskType,
    createTaskName: (composeFile: string, target: string): string =>
        `Deploy ${composeFile} to ${target}`,
    createArgs: (invocation: TopoDeployTaskInvocation): string[] => {
        const { target, settings } = invocation;
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
    public createTask(invocation: TopoDeployTaskInvocation): vscode.Task {
        return createTopoComposeTask(taskSpec, invocation);
    }
}
