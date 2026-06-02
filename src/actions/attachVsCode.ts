import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import { ContainerCommands } from '../target/containerCommands';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { isWrappedError } from '../errors/wrappedError';
import { showAndLogError } from '../util/showAndLogError';

export function getDockerContextName(ssh: string): string {
    return ssh.replace(/[^a-zA-Z0-9_.+-]/g, '-');
}

export class AttachVsCode {
    constructor(private readonly containerCommands: ContainerCommands) {}

    public async attachVsCodeCommandHandler(treeNode: unknown): Promise<void> {
        assertTargetContainerTreeItem(treeNode);
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
        await this.containerCommands.ensureContext(dockerContext, item.target);
        await this.containerCommands.executeWithContext(
            attachVsCodeOperation,
            dockerContext,
            3000,
        );
    }
}
