import * as vscode from 'vscode';
import { ContainerItem, ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';

export class ContainerStart {

    public static readonly startContainerCommand = `${manifest.PACKAGE_NAME}.startContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: Pick<ContainersManager, 'startContainer'>,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerStart.startContainerCommand, this.startContainer.bind(this))
        );
    }

    private async startContainer(item: ContainerItem) {
        try {
            await this.containersManager.startContainer(item.id);
        } catch (err: unknown) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`Failed to start service. ${err.message}`);
            } else {
                vscode.window.showErrorMessage('Failed to start service. Unknown error');
            }
        }
    }

}
