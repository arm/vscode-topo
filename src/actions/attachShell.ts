import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { TargetModel } from '../models/targetModel';

export class AttachShell {
    public static readonly attachShellCommand = `${manifest.PACKAGE_NAME}.attachShell`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
        private readonly targetModel: TargetModel,
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
        this.attachShell(treeNode.containerItem);
    }

    public attachShell(item: ContainerItem): void {
        const terminal = vscode.window.createTerminal({
            name: `Shell: ${item.image}`,
        });
        terminal.sendText(
            this.containerCommands.getAttachShellCommand(item.id, item.target),
        );
        terminal.show();
    }

    public attachSSH() {
        const target = this.targetModel.selected;
        if (!target) {
            throw new Error('No target is currently selected');
        }
        const terminal = vscode.window.createTerminal({
            name: `SSH: ${target}`,
        });
        terminal.sendText(`ssh ${target}`);
        terminal.show();
    }
}
