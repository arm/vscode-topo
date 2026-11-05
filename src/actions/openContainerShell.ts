import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../services/containerCommands';
import { getContainerTreeItem } from '../views/treeItems/getContainerTreeItem';

export class OpenContainerShell {
    constructor(private readonly containerCommands: ContainerCommands) {}

    public async openContainerShellCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        const item = getContainerTreeItem(treeNode);
        openContainerShell(item.containerItem, this.containerCommands);
    }
}

export function openContainerShell(
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
