import * as vscode from 'vscode';
import { TopoCli } from '../services/topoCli';
import { TargetModel } from '../models/targetModel';
import {
    promptForLocalCloneSource,
    promptForRemoteCloneSource,
} from '../util/projectClone';
import { type Result, success } from '../util/result';
import { showAndLogError } from '../util/showAndLog';
import { ProjectCloner } from '../operations/projectCloner';

function wrapCloneCommandWithCloneErrorHandling(
    commandHandler: () => Promise<Result<void>>,
): () => Promise<void> {
    return async () => {
        const result = await commandHandler();
        if (result.kind === 'error') {
            if (result.code !== 'CLONE' && result.code !== 'CLI') {
                throw result;
            }
            showAndLogError('Failed to clone project', result);
        }
    };
}

const cloneMethodItems = [
    {
        label: 'Remote Project',
        description:
            'Clone from a custom git repo or curated catalog of projects',
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
        private readonly projectCloner: ProjectCloner,
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
                return success();
            }
            return this.projectCloner.clone(source);
        },
    );

    public localCloneCommandHandler = wrapCloneCommandWithCloneErrorHandling(
        async () => {
            const source = await promptForLocalCloneSource();
            if (!source) {
                return success();
            }
            return this.projectCloner.clone(source);
        },
    );
}
