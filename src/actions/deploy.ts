import * as vscode from 'vscode';
import { getErrorMessage } from '../util/getErrorMessage';
import path from 'node:path';
import { executeTask } from '../util/executeTask';
import { showAndLogError } from '../util/showAndLogError';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';
import { isWrappedError, WrappedError } from '../errors/wrappedError';

const viewLogsItem: vscode.MessageItem = {
    title: 'View Logs',
};

export interface ComposeFile {
    uri: vscode.Uri;
    relativePath: string;
    workspaceIndex: number;
    workspaceName?: string;
}

type ComposeFileQuickPickItem = vscode.QuickPickItem & {
    uri: vscode.Uri;
};

export class Deploy {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public async deployCommandHandler(): Promise<void> {
        let resource: vscode.Uri | undefined;
        try {
            resource = await selectComposeFile();
        } catch (err: unknown) {
            if (isWrappedError(err, ['DEPLOY'])) {
                showAndLogError('Error executing deploy command', err);
                return;
            }
            throw err;
        }
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

async function selectComposeFile(): Promise<vscode.Uri | undefined> {
    const composeFiles = await findComposeFiles();
    if (composeFiles.length === 0) {
        throw new WrappedError(
            'DEPLOY',
            'No compose.yaml or compose.yml files found in the workspace.',
        );
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
        placeHolder: 'Select a compose file to deploy',
    });

    return selected?.uri;
}

export async function findComposeFiles(): Promise<ComposeFile[]> {
    const composeFiles = await vscode.workspace.findFiles(
        '**/compose.{yaml,yml}',
    );

    return composeFiles.map(getComposeFile).sort(compareComposeFiles);
}

function getComposeFile(uri: vscode.Uri): ComposeFile {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return {
            uri,
            relativePath: path.basename(uri.fsPath),
            workspaceIndex: Number.MAX_SAFE_INTEGER,
        };
    }

    return {
        uri,
        relativePath: path.relative(workspaceFolder.uri.fsPath, uri.fsPath),
        workspaceIndex: workspaceFolder.index,
        workspaceName: workspaceFolder.name,
    };
}

function compareComposeFiles(a: ComposeFile, b: ComposeFile): number {
    const priorityDiff = getComposeFilePriority(a) - getComposeFilePriority(b);
    if (priorityDiff !== 0) {
        return priorityDiff;
    }

    const workspaceDiff = a.workspaceIndex - b.workspaceIndex;
    if (workspaceDiff !== 0) {
        return workspaceDiff;
    }

    return a.relativePath.localeCompare(b.relativePath);
}

function getComposeFilePriority(composeFile: ComposeFile): number {
    const isYamlFile = path.extname(composeFile.uri.fsPath) === '.yaml';
    const isWorkspaceRootFile = path.dirname(composeFile.relativePath) === '.';
    if (isWorkspaceRootFile) {
        return isYamlFile ? 0 : 1;
    }
    return isYamlFile ? 2 : 3;
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
