import path from 'node:path';
import * as vscode from 'vscode';
import { ProjectTreeItem } from '../../views/treeItems/projectTreeItem';
import { unloaded } from '../loadable';

export function createProjectTreeItem(
    composeFileUri: vscode.Uri,
): ProjectTreeItem {
    return new ProjectTreeItem(
        {
            name: 'demo',
            uri: vscode.Uri.file(path.dirname(composeFileUri.fsPath)),
            composeFileUri,
            workspaceIndex: 0,
            workspaceName: 'workspace',
        },
        false,
        unloaded(),
    );
}
