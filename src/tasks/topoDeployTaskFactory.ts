import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { Config } from '../services/config';
import { COMPOSE_FILE_NAME } from '../util/composeFile';
import {
    createTopoComposeTask,
    type TopoComposeTaskInvocation,
} from './topoComposeTask';

export class TopoDeployTaskFactory {
    public readonly type = `${PACKAGE_NAME}.deploy`;
    private readonly taskSpec = {
        type: this.type,
        createTaskName: (composeFile: string, target: string): string =>
            `Deploy ${composeFile} to ${target}`,
        createArgs: (invocation: TopoComposeTaskInvocation): string[] => {
            const { target } = invocation;
            const settings = this.config.getTargetSettings(target).deploy ?? {};
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

    constructor(private readonly config: Config) {}

    public createTask(invocation: TopoComposeTaskInvocation): vscode.Task {
        return createTopoComposeTask(this.taskSpec, invocation);
    }
}
