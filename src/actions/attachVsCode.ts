import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { getDockerContextName } from '../util/dockerContext';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { isWrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLogError';

export class AttachVsCode {
    public static readonly attachVsCodeCommand = `${manifest.PACKAGE_NAME}.attachVsCode`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly containerCommands: ContainerCommands,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                AttachVsCode.attachVsCodeCommand,
                this.attachVsCodeCommandHandler.bind(this),
            ),
        );
    }

    private async attachVsCodeCommandHandler(treeNode: unknown) {
        assertTargetTreeContainerItem(treeNode);
        try {
            await this.attachVsCode(treeNode.containerItem);
        } catch (err: unknown) {
            if (isWrappedError(err, ['DOCKER'])) {
                const userError = `Failed to attach VS Code to the container ${treeNode.containerItem.id}`;
                showAndLogError(userError, err);
                return;
            }
            throw err;
        }
    }

    public async attachVsCode(item: ContainerItem): Promise<void> {
        const attachVsCodeOperation = () => {
            vscode.commands.executeCommand(
                'remote-containers.attachToRunningContainer',
                item.id,
            );
        };
        const dockerContext = getDockerContextName(item.target);
        await this.containerCommands.ensureContext(
            dockerContext,
            item.target.ssh,
        );
        await this.containerCommands.executeWithContext(
            attachVsCodeOperation,
            dockerContext,
            3000,
        );
    }
}
