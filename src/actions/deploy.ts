import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';
import { ProjectController } from '../controllers/projectController';
import { isWrappedError, WrappedError } from '../errors/wrappedError';
import {
    COMPOSE_FILE_GLOB,
    compareComposeFiles,
    getComposeFileMetadata,
    getPreferredComposeFiles,
    type ComposeFileMetadata,
} from '../util/composeFile';
import { ProjectTreeItem } from '../views/treeItems/projectTreeItem';
import {
    TargetDeploySettings,
    getTargetDeploySettingsForTarget,
} from '../services/targetDeploySettings';

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
        private readonly projectController: ProjectController,
    ) {}

    public async deployCommandHandler(): Promise<void> {
        const deployTarget = this.getSelectedDeployTarget();
        if (!deployTarget) {
            return;
        }

        const files = await vscode.workspace.findFiles(COMPOSE_FILE_GLOB);
        if (files.length === 0) {
            vscode.window.showErrorMessage(
                'No compose.yaml or compose.yml files found in the workspace.',
            );
            return;
        }

        const composeFileMetadata = files.map((file) =>
            getComposeFileMetadata(
                file,
                vscode.workspace.getWorkspaceFolder(file),
            ),
        );
        const preferredComposeFiles =
            getPreferredComposeFiles(composeFileMetadata);
        const composeFiles = preferredComposeFiles.sort(compareComposeFiles);

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
            throw new Error(
                'No compose.yaml or compose.yml selected for deployment',
            );
        }

        const deployTarget = this.getSelectedDeployTarget();
        if (!deployTarget) {
            return;
        }

        await this.deployComposeFile(resource, deployTarget);
    }

    public async deployProjectCommandHandler(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof ProjectTreeItem)) {
            throw new Error(
                'No compose.yaml or compose.yml selected for deployment',
            );
        }

        await this.deployContextCommandHandler(treeNode.composeFileUri);
    }

    private getSelectedTarget(): string {
        const target = this.targetModel.selected;
        if (!target) {
            throw new WrappedError(
                'NO_TARGET_SELECTED',
                'No target selected. Please select a target before deploying.',
            );
        }
        return target;
    }

    private getSelectedDeployTarget(): DeployTarget | undefined {
        let target: string;
        try {
            target = this.getSelectedTarget();
        } catch (err: unknown) {
            if (isWrappedError(err, ['NO_TARGET_SELECTED'])) {
                showAndLogError('Error executing deploy command', err);
                return undefined;
            }
            throw err;
        }

        try {
            return {
                target,
                settings: getTargetDeploySettingsForTarget(target),
            };
        } catch (err: unknown) {
            showAndLogError('Error retrieving target deploy settings', err);
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
    composeFilePath: string,
    target: string,
    settings: TargetDeploySettings = {},
): Promise<void> {
    const task = createProcessTask(
        `Deploy to ${target}`,
        ['topo', ...buildDeployArgs(target, settings)],
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
    settings: TargetDeploySettings = {},
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
    return args;
}
