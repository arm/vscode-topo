import * as vscode from 'vscode';
import { TopoCli } from '../services/topoCli';
import { TargetModel } from '../models/targetModel';
import {
    cloneProjectFromSource,
    getLocalSourcePath,
    promptForRemoteCloneSource,
} from '../util/projectClone';
import { isWrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLog';
import { TaskExecutor } from '../util/taskExecutor';

function wrapCloneCommandWithCloneErrorHandling(
    commandHandler: () => Promise<void>,
): () => Promise<void> {
    return async () => {
        try {
            await commandHandler();
        } catch (error: unknown) {
            if (isWrappedError(error, ['CLONE', 'CLI'])) {
                return showAndLogError('Failed to clone project', error);
            }
            throw error;
        }
    };
}

const cloneMethodItems = [
    {
        label: 'Remote Project',
        description:
            'Clone from a custom git repo or curated catalog of Templates',
        cloneMethod: 'remote',
    },
    {
        label: 'Local Project',
        description: 'Clone from a local directory on your machine',
        cloneMethod: 'local',
    },
] as const;

export class ProjectClone {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
        private readonly taskExecutor: TaskExecutor,
    ) {}

    public cloneCommandHandler = async (): Promise<void> => {
        const selectedMethod = await vscode.window.showQuickPick(
            cloneMethodItems,
            {
                placeHolder: 'Select a clone method',
            },
        );
        if (!selectedMethod) {
            return;
        }

        switch (selectedMethod.cloneMethod) {
            case 'remote':
                return this.remoteCloneCommandHandler();
            case 'local':
                return this.localCloneCommandHandler();
        }
    };

    public remoteCloneCommandHandler = wrapCloneCommandWithCloneErrorHandling(
        async () => {
            const selectedTarget = this.targetModel.selected;
            const source = await promptForRemoteCloneSource(
                this.topoCli,
                selectedTarget,
            );
            if (!source) {
                return;
            }
            await cloneProjectFromSource(this.taskExecutor, source);
        },
    );

    public localCloneCommandHandler = wrapCloneCommandWithCloneErrorHandling(
        async () => {
            const cloneSourcePath = await getLocalSourcePath();
            if (!cloneSourcePath) {
                return;
            }
            await cloneProjectFromSource(this.taskExecutor, {
                type: 'dir',
                path: cloneSourcePath,
            });
        },
    );
}
