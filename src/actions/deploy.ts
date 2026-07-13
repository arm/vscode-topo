import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogError, showAndLogWarning } from '../util/showAndLog';
import { TargetModel } from '../models/targetModel';
import { ProjectController } from '../controllers/projectController';
import { isWrappedError } from '../errors/wrappedError';
import {
    COMPOSE_FILE_GLOB,
    compareComposeFiles,
    getComposeFileMetadata,
    selectComposeFile,
    type ComposeFileMetadata,
} from '../util/composeFile';
import { ProjectTreeItem } from '../views/treeItems/projectTreeItem';
import {
    assertTargetConnected,
    assertTargetSelected,
} from '../util/assertTargetReady';
import {
    TargetSettings,
    getSettingsForTarget,
} from '../services/targetSettings';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

type ComposeFileQuickPickItem = vscode.QuickPickItem & {
    uri: vscode.Uri;
};

type DeployTarget = {
    target: string;
    settings: TargetSettings;
};

export class Deploy {
    constructor(
        private readonly taskExecutor: TaskExecutor,
        private readonly targetModel: TargetModel,
        private readonly projectController: ProjectController,
    ) {}

    public async deployCommandHandler(): Promise<void> {
        const deployTarget = this.getSelectedDeployTarget();
        if (!deployTarget) {
            return;
        }

        const composeFileUris =
            await vscode.workspace.findFiles(COMPOSE_FILE_GLOB);
        const composeFiles = composeFileUris
            .map((uri) =>
                getComposeFileMetadata(
                    uri,
                    vscode.workspace.getWorkspaceFolder(uri),
                ),
            )
            .sort(compareComposeFiles);
        if (composeFiles.length === 0) {
            vscode.window.showErrorMessage(
                'No Compose files found in the workspace.',
            );
            return;
        }

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
            throw new Error('No Compose file selected for deployment');
        }

        const deployTarget = this.getSelectedDeployTarget();
        if (!deployTarget) {
            return;
        }

        await this.deployComposeFile(resource, deployTarget);
    }

    public async deployProjectCommandHandler(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof ProjectTreeItem)) {
            throw new Error('No Compose file selected for deployment');
        }

        const resource = await selectComposeFile(
            treeNode.project.composeFileUris,
            'Select a Compose file to deploy',
        );
        if (!resource) {
            return;
        }

        await this.deployContextCommandHandler(resource);
    }

    private getSelectedDeployTarget(): DeployTarget | undefined {
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

        try {
            return {
                target,
                settings: getSettingsForTarget(target),
            };
        } catch (err: unknown) {
            showAndLogError('Error retrieving target settings', err);
            return undefined;
        }
    }

    private async deployComposeFile(
        resource: vscode.Uri,
        deployTarget: DeployTarget,
    ): Promise<void> {
        await deploy(
            this.taskExecutor,
            resource.fsPath,
            deployTarget.target,
            deployTarget.settings,
        );
        await this.projectController.refreshProjectContainersCommandHandler();
    }
}

async function promptForComposeFile(
    composeFiles: ComposeFileMetadata[],
): Promise<vscode.Uri | undefined> {
    if (composeFiles.length <= 1) {
        return composeFiles[0]?.uri;
    }

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
        placeHolder: 'Select a Compose file to deploy',
    });

    return selected?.uri;
}

export async function deploy(
    taskExecutor: TaskExecutor,
    composeFilePath: string,
    target: string,
    settings: TargetSettings = {},
): Promise<void> {
    const task = createProcessTask(
        `Deploy to ${target}`,
        ['topo', ...buildDeployArgs(target, composeFilePath, settings)],
        {
            cwd: path.dirname(composeFilePath),
        },
    );
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

export function buildDeployArgs(
    target: string,
    composeFilePath: string,
    settings: TargetSettings = {},
): string[] {
    const args = ['deploy', '--target', target];
    if (settings.port !== undefined) {
        args.push('-p', String(settings.port));
    }
    if (settings.forceRecreate) {
        args.push('--force-recreate');
    }
    if (settings.noRecreate) {
        args.push('--no-recreate');
    }
    args.push('-f', path.basename(composeFilePath));
    return args;
}
