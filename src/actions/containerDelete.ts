import * as vscode from 'vscode';
import { ContainerItem, ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';

export class ContainerDelete {

    public static readonly deleteContainerCommand = `${manifest.PACKAGE_NAME}.deleteContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: Pick<ContainersManager, 'deleteContainer'>,
    ) {}

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerDelete.deleteContainerCommand, this.deleteContainer.bind(this))
        );
    }

    private async deleteContainer(item: ContainerItem) {
        try {
            await this.containersManager.deleteContainer(item.id);
        } catch (err: unknown) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`Failed to delete service. ${err.message}`);
            } else {
                vscode.window.showErrorMessage('Failed to delete service. Unknown error');
            }
        }
    }

}
