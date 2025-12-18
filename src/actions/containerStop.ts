import * as vscode from 'vscode';
import { ContainerItem, ContainersManager } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';

export class ContainerStop {

    public static readonly stopContainerCommand = `${manifest.PACKAGE_NAME}.stopContainer`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containersManager: Pick<ContainersManager, 'stopContainer'>,
    ) {}

    public async activate() {

        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerStop.stopContainerCommand, this.stopContainer.bind(this)),
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
