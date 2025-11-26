import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { getDockerContextName } from '../util/dockerContext';

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
        await this.containerCommands.executeWithContext(attachVsCodeOperation, dockerContext, 3000);
    }
}
