import * as vscode from 'vscode';
import { ContainerItem, ContainersManager } from '../workloadPlacement/containersManager';

export class ContainerStop {
    constructor(
        private readonly context: vscode.ExtensionContext,
    private readonly containersManager: Pick<ContainersManager, 'stopContainer'>,
    ) {}

    public async activate() {

        this.context.subscriptions.push(
            vscode.commands.registerCommand('containerExplorer.stopContainer', this.stopContainer.bind(this)),
        );
    }

    private async stopContainer(item: ContainerItem) {
        try {
            await this.containersManager.stopContainer(item.id);
        } catch (err: unknown) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`Failed to stop service. ${err.message}`);
            } else {
                vscode.window.showErrorMessage('Failed to stop service. Unknown error');
            }
        }
    }

}
