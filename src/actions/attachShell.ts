import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { getDockerContextName } from '../util/dockerContext';
import { TargetStore } from '../workloadPlacement/targetStore';

export class AttachShell {

    public static readonly attachShellCommandType = `${manifest.PACKAGE_NAME}.attachShell`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
        private readonly targetStore: Pick<TargetStore, 'getSelectedTarget'>,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(AttachShell.attachShellCommandType, this.attachShell.bind(this))
        );
    }

    public async attachShell(item: ContainerItem) {
        const terminal = vscode.window.createTerminal({ name: `Shell: ${item.image}` });
        terminal.sendText(this.containerCommands.getAttachShellCommand(item.id, getDockerContextName(item.target)));
        terminal.show();
    }

    public async attachSSH() {
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            vscode.window.showErrorMessage('No target is currently selected');
            return;
        }
        const terminal = vscode.window.createTerminal({ name: `SSH: ${target.id}` });
        terminal.sendText(`ssh ${target.ssh}`);
        terminal.show();
    }
}
