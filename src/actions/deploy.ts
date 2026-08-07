import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogError, showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { isWrappedError } from '../errors/wrappedError';
import {
    COMPOSE_FILE_GLOB,
    compareComposeFiles,
    getComposeFileMetadata,
    type ComposeFileMetadata,
} from '../util/composeFile';
import { assertProjectTreeItem } from '../views/treeItems/assertProjectTreeItem';
import {
    assertTargetConnected,
    assertTargetSelected,
} from '../util/assertTargetReady';
import {
    type TopoDeployTaskDefinition,
    type DeployTaskFactory,
} from '../tasks/deployTaskFactory';
import { Config } from '../services/config';
import type { TargetDeploySettings } from '../util/targetSettings';
import { TOPO_DEPLOY_TASK_TYPE } from '../manifest';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

type ComposeFileQuickPickItem = vscode.QuickPickItem & {
    uri: vscode.Uri;
};

type DeployTarget = {
    target: string;
    settings: TargetDeploySettings;
};

export class Deploy {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly config: Config,
        private readonly taskFactory: DeployTaskFactory,
    ) {}

    public async deployCommandHandler(): Promise<void> {
        let deployTarget: DeployTarget;
        try {
            deployTarget = this.getSelectedDeployTarget();
        } catch (error: unknown) {
            this.handleDeployTargetError(error);
            return;
        }

        const files = await vscode.workspace.findFiles(COMPOSE_FILE_GLOB);
        if (files.length === 0) {
            vscode.window.showErrorMessage(
                'No compose.yaml files found in the workspace.',
            );
            return;
        }

        const composeFileMetadata = files.map((file) =>
            getComposeFileMetadata(
                file,
                vscode.workspace.getWorkspaceFolder(file),
            ),
        );
        const composeFiles = composeFileMetadata.sort(compareComposeFiles);

        const resource = await promptForComposeFile(composeFiles);
        if (!resource) {
            return;
        }
        await this.deployComposeFile(resource, deployTarget);
    }

    public async deployContextCommandHandler(
        resource?: vscode.Uri,
    ): Promise<void> {
        if (!resource) {
            throw new Error('No compose.yaml selected for deployment');
        }

        let deployTarget: DeployTarget;
        try {
            deployTarget = this.getSelectedDeployTarget();
        } catch (error: unknown) {
            this.handleDeployTargetError(error);
            return;
        }

        await this.deployComposeFile(resource, deployTarget);
    }

    public async deployProjectCommandHandler(treeNode: unknown): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.deployContextCommandHandler(treeNode.composeFileUri);
    }

    private handleDeployTargetError(error: unknown): void {
        if (isWrappedError(error, ['TARGET'])) {
            showAndLogWarning('Cannot deploy', error);
            return;
        }
        if (isWrappedError(error, ['CONFIG'])) {
            showAndLogError('Error retrieving target settings', error);
            return;
        }
        throw error;
    }

    private getSelectedDeployTarget(): DeployTarget {
        const target = this.targetModel.selected;
        const health = this.targetModel.selectedTargetHealth;
        assertTargetSelected(target);
        assertTargetConnected(target, health);

        const targetSettings = this.config.getTargetSettings(target);
        return {
            target,
            settings: targetSettings.deploy ?? {},
        };
    }

    private async deployComposeFile(
        resource: vscode.Uri,
        deployTarget: DeployTarget,
    ): Promise<void> {
        const definition: TopoDeployTaskDefinition = {
            type: TOPO_DEPLOY_TASK_TYPE,
            target: deployTarget.target,
            composeFile: resource.fsPath,
            settings: deployTarget.settings,
        };
        await deploy(this.taskExecutor, this.taskFactory, definition);
    }
}

async function promptForComposeFile(
    composeFiles: ComposeFileMetadata[],
): Promise<vscode.Uri | undefined> {
    const showWorkspaceName =
        (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
    const items: ComposeFileQuickPickItem[] = composeFiles.map(
        ({ uri, relativePath, workspaceName }) => ({
            label: relativePath,
            description: showWorkspaceName ? workspaceName : undefined,
            uri,
        }),
    );
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a compose file to deploy',
    });

    return selected?.uri;
}

export async function deploy(
    taskExecutor: TaskExecutor,
    taskFactory: DeployTaskFactory,
    definition: TopoDeployTaskDefinition,
): Promise<void> {
    const { target } = definition;
    const task = taskFactory.createTask(definition);
    const taskName = task.name;

    try {
        await taskExecutor.run(task);
    } catch (e) {
        const terminal = vscode.window.terminals.find(
            (t) => t.name === taskName,
        );
        const actions: vscode.MessageItem[] = [];
        if (terminal) {
            actions.push(viewLogsItem);
        }
        const choice = await vscode.window.showErrorMessage(
            `Deployment to ${target} failed: ${getErrorMessage(e)}`,
            ...actions,
        );
        if (choice?.title === viewLogsItem.title) {
            terminal?.show();
        }
        return;
    }
    vscode.window.showInformationMessage(
        `Deployment to ${target} completed successfully.`,
    );
}
