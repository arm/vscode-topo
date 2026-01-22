import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { TargetStore } from '../workloadPlacement/targetStore';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';

export class AttachShell {
    public static readonly attachShellCommand = `${manifest.PACKAGE_NAME}.attachShell`;

    constructor(
        private readonly context: Pick<
            vscode.ExtensionContext,
            'subscriptions'
        >,
        private readonly containerCommands: ContainerCommands,
        private readonly targetStore: Pick<TargetStore, 'getSelectedTarget'>,
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
            this.containerCommands.getAttachShellCommand(
                item.id,
                item.target.ssh,
            ),
        );
        terminal.show();
    }

    public async attachSSH() {
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            throw new Error('No target is currently selected');
        }
        const terminal = vscode.window.createTerminal({
            name: `SSH: ${target.id}`,
        });
        terminal.sendText(`ssh ${target.ssh}`);
        terminal.show();
    }
}
