import * as vscode from 'vscode';
import { TopoCli } from '../topoCli';
import { TargetModel } from '../models/targetModel';
import {
    cloneProjectFromSource,
    getLocalSourcePath,
    getTemplateOfChoice,
} from '../util/projectClone';
import { isWrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLogError';
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
        description: 'Clone from a remote git repository',
        cloneMethod: 'remote',
    },
    {
        label: 'Template Project',
        description: 'Clone from a curated set of templates',
        cloneMethod: 'template',
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
            case 'template':
                return this.templateCloneCommandHandler();
            case 'local':
                return this.localCloneCommandHandler();
        }
    };

    public templateCloneCommandHandler = wrapCloneCommandWithCloneErrorHandling(
        async () => {
            const selectedTarget = this.targetModel.selected;
            const selectedTemplate = await getTemplateOfChoice(
                this.topoCli,
                selectedTarget,
            );
            if (!selectedTemplate) {
                return;
            }
            await cloneProjectFromSource(this.taskExecutor, {
                type: 'git',
                url: selectedTemplate.url,
            });
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

    public remoteCloneCommandHandler = wrapCloneCommandWithCloneErrorHandling(
        async () => {
            const cloneSourceRemoteUrl = await vscode.window.showInputBox({
                prompt: 'Enter the git URL to clone from',
            });
            if (!cloneSourceRemoteUrl) {
                return;
            }
            await cloneProjectFromSource(this.taskExecutor, {
                type: 'git',
                url: cloneSourceRemoteUrl,
            });
        },
    );
}
