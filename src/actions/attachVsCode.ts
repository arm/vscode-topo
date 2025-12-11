import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { getDockerContextName } from '../util/dockerContext';
import { getErrorMessage } from '../util/getErrorMessage';

export class AttachVsCode {

    public static readonly attachVsCodeCommandType = `${manifest.PACKAGE_NAME}.attachVsCode`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(AttachVsCode.attachVsCodeCommandType, this.attachVsCodeToContainer.bind(this))
        );
    }

    public async attachVsCodeToContainer(item: ContainerItem): Promise<void> {
        const attachVsCodeOperation = () => {
            vscode.commands.executeCommand(
                'remote-containers.attachToRunningContainer',
                item.id
            );
        };
        const dockerContext = getDockerContextName(item.target);
        try {
            await this.containerCommands.ensureContext(dockerContext, item.target.ssh);
            await this.containerCommands.executeWithContext(attachVsCodeOperation, dockerContext, 3000);
        } catch (err: unknown) {
            vscode.window.showErrorMessage(`Failed to attach VS Code to container: ${getErrorMessage(err)}`);
        }
    }
}
