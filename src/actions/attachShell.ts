import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { quoteShellArgument } from '../util/quoteShellArgument';

export class AttachShell {
    public static readonly attachShellCommand = `${manifest.PACKAGE_NAME}.attachShell`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                AttachShell.attachShellCommand,
                this.attachShellCommandHandler.bind(this),
            ),
        );
    }

    private async attachShellCommandHandler(treeNode: unknown): Promise<void> {
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
    terminal.sendText(`ssh ${quoteShellArgument(target)}`);
    terminal.show();
}
