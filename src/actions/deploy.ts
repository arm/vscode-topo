import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { ProjectController } from '../controllers/projectController';
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
import { TopoDeployTaskFactory } from '../tasks/topoDeployTaskFactory';
import type { TopoComposeTaskInvocation } from '../tasks/topoComposeTask';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

type ComposeFileQuickPickItem = vscode.QuickPickItem & {
    uri: vscode.Uri;
};

export class Deploy {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly projectController: ProjectController,
        private readonly deployTaskFactory: TopoDeployTaskFactory,
    ) {}

    public async deployCommandHandler(): Promise<void> {
        const deployTarget = this.getSelectedDeployTarget();
        if (!deployTarget) {
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

        const deployTarget = this.getSelectedDeployTarget();
        if (!deployTarget) {
            return;
        }

        await this.deployComposeFile(resource, deployTarget);
    }

    public async deployProjectCommandHandler(treeNode: unknown): Promise<void> {
        assertProjectTreeItem(treeNode);
        await this.deployContextCommandHandler(treeNode.composeFileUri);
    }

    private getSelectedDeployTarget(): string | undefined {
        const target = this.targetModel.selected;
        const health = this.targetModel.selectedTargetHealth;
        try {
            assertTargetSelected(target);
            assertTargetConnected(target, health);
        } catch (err: unknown) {
            if (isWrappedError(err, ['TARGET'])) {
                showAndLogWarning('Cannot deploy', err);
                return undefined;
            }
            throw err;
        }

        return target;
    }

    private async deployComposeFile(
        resource: vscode.Uri,
        target: string,
    ): Promise<void> {
        await deploy(this.taskExecutor, this.deployTaskFactory, {
            target,
            composeFilePath: resource.fsPath,
        });
        await this.projectController.refreshProjectContainersCommandHandler();
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
    deployTaskFactory: TopoDeployTaskFactory,
    invocation: TopoComposeTaskInvocation,
): Promise<void> {
    const { target } = invocation;
    let taskName: string | undefined;

    try {
        const task = deployTaskFactory.createTask(invocation);
        taskName = task.name;
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
