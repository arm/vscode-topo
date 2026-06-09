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

export class ProjectClone {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

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
            await cloneProjectFromSource(this.topoCli, {
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
            await cloneProjectFromSource(this.topoCli, {
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
            await cloneProjectFromSource(this.topoCli, {
                type: 'git',
                url: cloneSourceRemoteUrl,
            });
        },
    );
}
