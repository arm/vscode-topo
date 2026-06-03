import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';

export class AttachShell {
    public async attachShellCommandHandler(treeNode: unknown): Promise<void> {
        assertTargetContainerTreeItem(treeNode);
        attachShell(treeNode.containerItem);
    }
}

const getSshUri = (targetSshConnection: string): string => {
    return `ssh://${targetSshConnection}`;
};

export function attachShell(item: ContainerItem): void {
    const terminal = vscode.window.createTerminal({
        name: `Shell: ${item.image}`,
        shellPath: 'docker',
        shellArgs: [
            '--host',
            getSshUri(item.target),
            'exec',
            '-it',
            item.id,
            'sh',
        ],
    });
    terminal.show();
}

export function attachSSH(target: string): void {
    const terminal = vscode.window.createTerminal({
        name: `SSH: ${target}`,
        shellPath: 'ssh',
        shellArgs: [target],
    });
    terminal.show();
}
