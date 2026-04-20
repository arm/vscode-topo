import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../workloadPlacement/containerCommands';
import * as manifest from '../manifest';
import { assertTargetTreeContainerItem } from './util/assertTargetTreeContainerItem';
import { isTopoError } from '../errors/topoError';
import { showAndLogError } from '../util/showAndLogError';

export function getDockerContextName(ssh: string): string {
    return ssh.replace(/[^a-zA-Z0-9_.+-]/g, '-');
}

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
            if (isTopoError(err) && err.code === 'DOCKER') {
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
        const dockerContext = getDockerContextName(item.target.ssh);
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
