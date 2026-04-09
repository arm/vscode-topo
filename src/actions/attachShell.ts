import * as vscode from 'vscode';
import { BOARD_HOSTNAME, BOARD_SSH_CONNECTION } from '../manifest';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';

export class AttachShell {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('containerExplorer.attachShell', this.attachShell.bind(this))
        );
    }

    public async attachShell(item: ContainerItem) {
        const terminal = vscode.window.createTerminal({ name: `Shell: ${item.image}` });
        terminal.sendText(this.containerCommands.getAttachShellCommand(item.id));
        terminal.show();
    }

    public async attachSSH() {
        const terminal = vscode.window.createTerminal({ name: `SSH: ${BOARD_HOSTNAME}` });
        terminal.sendText(`ssh ${BOARD_SSH_CONNECTION}`);
        terminal.show();
    }
}
