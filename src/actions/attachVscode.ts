import * as vscode from 'vscode';
import { BOARD_DOCKER_CONTEXT } from '../manifest';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';

export class AttachVscode {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('containerExplorer.attachVscode', this.attachVsCodeToContainer.bind(this))
        );
    }

    public async attachVsCodeToContainer(item: ContainerItem): Promise<void> {
        const attachVsCodeOperation = () => {
            vscode.commands.executeCommand(
                'remote-containers.attachToRunningContainer',
                item.id
            );
        };
        await this.containerCommands.executeWithContext(attachVsCodeOperation, BOARD_DOCKER_CONTEXT, 3000);
    }
}
