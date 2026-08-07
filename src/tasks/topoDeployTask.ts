import { COMPOSE_FILE_NAME } from '../util/composeFile';
import type { TargetDeploySettings } from '../util/targetSettings';
import type { TopoComposeTaskInvocation } from './topoComposeTask';

export interface TopoDeployTaskInvocation extends TopoComposeTaskInvocation {
    readonly settings: TargetDeploySettings;
}

export const topoDeployTaskSpec = {
    createTaskName: (composeFilePath: string, target: string): string =>
        `Deploy ${composeFilePath} to ${target}`,
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
