import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import { TargetStore } from '../target/targetStore';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { isWrappedError, WrappedError } from '../errors/wrappedError';

export class AttachShell {
    public static readonly attachShellCommand = `${manifest.PACKAGE_NAME}.attachShell`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
        private readonly targetStore: TargetStore,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                AttachShell.attachShellCommand,
                this.handleAttachShellCommand.bind(this),
            ),
        );
    }

    private async handleAttachShellCommand(treeNode: unknown): Promise<void> {
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

    public attachSSH(): void {
        let target: string | undefined;
        try {
            target = this.targetStore.getSelectedTarget();
        } catch (err) {
            if (isWrappedError(err, ['TARGET'])) {
                showAndLogError('Failed to attach SSH', err);
                return;
            }
            throw err;
        }
        if (!target) {
            showAndLogError(
                'Failed to attach SSH',
                new WrappedError('TARGET', 'No selected target found'),
            );
            return;
        }
        const terminal = vscode.window.createTerminal({
            name: `SSH: ${target}`,
        });
        terminal.sendText(`ssh ${target}`);
        terminal.show();
    }
}
