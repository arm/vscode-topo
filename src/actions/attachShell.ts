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

export function attachShell(
    item: ContainerItem,
    containerCommands: ContainerCommands,
): void {
    const terminal = vscode.window.createTerminal({
        name: `Shell: ${item.image}`,
    });
    terminal.sendText(
        containerCommands.getAttachShellCommand(item.id, item.target),
    );
    terminal.show();
}

export function attachSSH(target: string): void {
    const terminal = vscode.window.createTerminal({
        name: `SSH: ${target}`,
    });
    terminal.sendText(`ssh ${target}`);
    terminal.show();
}
