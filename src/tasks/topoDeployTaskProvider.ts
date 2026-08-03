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

export class TopoDeployTaskProvider {
    public readonly type = `${PACKAGE_NAME}.deploy`;
    private readonly taskSpec = {
        type: this.type,
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

    public createTask(invocation: TopoDeployTaskInvocation): vscode.Task {
        return createTopoComposeTask(this.taskSpec, invocation);
    }
}
