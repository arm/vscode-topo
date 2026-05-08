import * as vscode from 'vscode';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { ContainerItem } from '../util/types';

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
        assertTargetTreeContainerItem(treeNode);
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
}
