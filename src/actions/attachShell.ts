import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';

export class AttachShell {
    constructor(private readonly containerCommands: ContainerCommands) {}

    public async attachShellCommandHandler(treeNode: unknown): Promise<void> {
        assertTargetContainerTreeItem(treeNode);
        attachShell(treeNode.containerItem, this.containerCommands);
    }
}

const getSshUri = (targetSshConnection: string): string => {
    return `ssh://${targetSshConnection}`;
};

export function attachShell(
    item: ContainerItem,
    containerCommands: ContainerCommands,
): void {
    const fullCommand = containerCommands.getAttachShellCommand(
        item.id,
        item.target,
    );
    const terminal = vscode.window.createTerminal({
        name: `Shell: ${item.image}`,
        shellPath: fullCommand[0],
        shellArgs: fullCommand.slice(1),
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
