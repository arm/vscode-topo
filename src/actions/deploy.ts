import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';
import { showAndLogError, showAndLogWarning } from '../util/showAndLog';
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
    TargetSettings,
    getSettingsForTarget,
} from '../services/targetSettings';
import type { TargetHealthReport } from '../services/topoCliSchema';

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
                'TARGET',
                'No target selected. Please select a target before deploying.',
            );
        }

        const health = this.targetModel.selectedTargetHealth;
        if (health.loading) {
            throw new WrappedError(
                'TARGET',
                `Target ${target} health is still being checked. Wait for target health checks to finish before deploying.`,
            );
        }

        if (
            health.status === 'loaded' &&
            health.data.connectivity.status !== 'ok'
        ) {
            throw new WrappedError(
                'TARGET',
                getConnectivityFailureMessage(target, health.data),
            );
        }

        return target;
    }

    private getSelectedDeployTarget(): DeployTarget | undefined {
        let target: string;
        try {
            target = this.getSelectedTarget();
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

function getConnectivityFailureMessage(
    target: string,
    health: TargetHealthReport,
): string {
    const details = health.connectivity.value
        ? `: ${health.connectivity.value}`
        : '';
    return `Target ${target} connectivity is ${health.connectivity.status}${details}. Resolve target connectivity before deploying.`;
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
    settings: TargetSettings = {},
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
    return args;
}
