import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';
import { ensureTargetTreeContainerItem } from './util/ensureTargetTreeContainerItem';
import { logger } from '../util/logger';

type OperationResult = 'success' | 'no-web-ports';

export class ContainerOpenInBrowser {

    public static readonly openInBrowserCommand = `${manifest.PACKAGE_NAME}.openInBrowser`;

    constructor(
        private readonly context: vscode.ExtensionContext,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerOpenInBrowser.openInBrowserCommand, this.openContainerInBrowserCommandHandler.bind(this)),
        );
    }

    private async openContainerInBrowserCommandHandler(treeNode: unknown): Promise<void> {
        ensureTargetTreeContainerItem(treeNode);
        try {
            const result = await this.openContainerInBrowser(treeNode.containerItem);
            if (result === 'no-web-ports') {
                vscode.window.showWarningMessage(`No web ports found for container ${treeNode.containerItem.id}`);
            }
        } catch (err: unknown) {
            const errorMsg = `Failed to open the container ${treeNode.containerItem.id} in browser`;
            vscode.window.showErrorMessage(errorMsg);
            logger.error(errorMsg, err);
        }
    }

    public async openContainerInBrowser(item: ContainerItem): Promise<OperationResult> {
        const commonWebPorts = [443, 80, 3000, 3001, 5001, 5000, 5002, 8000, 8080, 8081];
        const containerWebPorts = commonWebPorts.find(port => item.ports.some(p => p.startsWith(`${port}:`)));
        const publishedPorts = item.ports
            .filter(p => p.startsWith(`${containerWebPorts}:`))
            .map(p => p.split(':')[0]);
        if (publishedPorts.length === 0) {
            return 'no-web-ports';
        }
        const target = item.target;
        const url = `http://${target.host}:${publishedPorts[0]}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return 'success';
    }

}
