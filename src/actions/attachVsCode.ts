import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { getDockerContextName } from '../util/dockerContext';
import { ensureTargetTreeContainerItem } from './util/ensureTargetTreeContainerItem';
import { logger } from '../util/logger';

export class AttachVsCode {

    public static readonly attachVsCodeCommand = `${manifest.PACKAGE_NAME}.attachVsCode`;

    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(AttachVsCode.attachVsCodeCommand, this.attachVsCodeCommandHandler.bind(this))
        );
    }

    private async attachVsCodeCommandHandler(treeNode: unknown) {
        ensureTargetTreeContainerItem(treeNode);
        try {
            await this.attachVsCode(treeNode.containerItem);
        } catch (err: unknown) {
            const errorMsg = `Failed to attach VS Code to the container ${treeNode.containerItem.id}`;
            vscode.window.showErrorMessage(errorMsg);
            logger.error(errorMsg, err);
        }
    }

    public async attachVsCode(item: ContainerItem): Promise<void> {
        const attachVsCodeOperation = () => {
            vscode.commands.executeCommand(
                'remote-containers.attachToRunningContainer',
                item.id
            );
        };
        const dockerContext = getDockerContextName(item.target);
        await this.containerCommands.ensureContext(dockerContext, item.target.ssh);
        await this.containerCommands.executeWithContext(attachVsCodeOperation, dockerContext, 3000);
    }
}
