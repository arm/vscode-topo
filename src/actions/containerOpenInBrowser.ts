import * as vscode from 'vscode';
import { ContainerItem } from '../util/types';
import * as manifest from '../manifest';
import { assertTargetContainerTreeItem } from '../targetTreeView/assertTargetContainerTreeItem';
import { logger } from '../util/logger';
import { getContainerHostPorts } from '../util/getContainerHostPorts';

type OperationResult = 'success' | 'no-web-ports';

export class ContainerOpenInBrowser {
    public static readonly openInBrowserCommand = `${manifest.PACKAGE_NAME}.openInBrowser`;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                ContainerOpenInBrowser.openInBrowserCommand,
                this.handleOpenInBrowserCommand.bind(this),
            ),
        );
    }

    private async handleOpenInBrowserCommand(treeNode: unknown): Promise<void> {
        assertTargetContainerTreeItem(treeNode);
        try {
            const result = await this.openContainerInBrowser(
                treeNode.containerItem,
            );
            if (result === 'no-web-ports') {
                vscode.window.showWarningMessage(
                    `No web ports found for container ${treeNode.containerItem.id}`,
                );
            }
        } catch (err: unknown) {
            const errorMsg = `Failed to open the container ${treeNode.containerItem.id} in browser`;
            vscode.window.showErrorMessage(errorMsg);
            logger.error(errorMsg, err);
        }
    }

    public async openContainerInBrowser(
        item: ContainerItem,
    ): Promise<OperationResult> {
        const commonWebPorts = [
            443, 80, 3000, 3001, 5001, 5000, 5002, 8000, 8080, 8081,
        ];
        const hostPorts = getContainerHostPorts(item);
        const openWebPort = commonWebPorts.find((p) => hostPorts.includes(p));
        if (!openWebPort) {
            return 'no-web-ports';
        }
        const target = item.target;
        // TODO won't work when target is an ssh config alias, need to resolve it to an actual host with ssh -G
        const url = `http://${target}:${openWebPort}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return 'success';
    }
}
