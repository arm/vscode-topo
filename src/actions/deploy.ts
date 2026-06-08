import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { executeTask } from '../util/executeTask';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import {
    COMPOSE_FILE_GLOB,
    compareComposeFiles,
    getComposeFile,
    getPreferredComposeFiles,
    type ComposeFile,
} from '../util/findComposeFiles';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

type ComposeFileQuickPickItem = vscode.QuickPickItem & {
    uri: vscode.Uri;
};

export class Deploy {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public async deployCommandHandler(): Promise<void> {
        const files = await vscode.workspace.findFiles(COMPOSE_FILE_GLOB);
        if (files.length === 0) {
            vscode.window.showErrorMessage(
                'No compose.yaml or compose.yml files found in the workspace.',
            );
            return;
        }

        const composeFileDescriptions = files.map((file) =>
            getComposeFile(file, vscode.workspace.getWorkspaceFolder(file)),
        );
        const preferredComposeFiles = getPreferredComposeFiles(
            composeFileDescriptions,
        );
        const composeFiles = preferredComposeFiles.sort(compareComposeFiles);

        const resource = await promptForComposeFile(composeFiles);
        if (!resource) {
            return;
        }
        await this.deployResource(resource);
    }

    public async deployContextCommandHandler(
        resource?: vscode.Uri,
    ): Promise<void> {
        if (!resource) {
            throw new Error(
                'No compose.yaml or compose.yml selected for deployment',
            );
        }
        await this.deployResource(resource);
    }

    private async deployResource(resource: vscode.Uri): Promise<void> {
        const target = this.targetModel.selected;

        if (!target) {
            showAndLogError(
                'Error executing deploy command',
                new Error(
                    'No target selected. Please select a target before deploying.',
                ),
            );
            return;
        }

        await deploy(this.topoCli.getBinaryPath(), resource.fsPath, target);
    }
}

async function promptForComposeFile(
    composeFiles: ComposeFile[],
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
    topoBinaryPath: string,
    composeFilePath: string,
    target: string,
): Promise<void> {
    const taskName = `Deploy to ${target}`;

    try {
        await executeTask(
            taskName,
            [topoBinaryPath, 'deploy', '--target', target],
            {
                cwd: path.dirname(composeFilePath),
            },
        );
        vscode.window.showInformationMessage(
            `Deployment to ${target} completed successfully.`,
        );
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
    }
}
