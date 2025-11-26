import * as vscode from 'vscode';
import { ContainerItem } from '../workloadPlacement/containersManager';
import * as manifest from '../manifest';

export class ContainerOpenInBrowser {

    public static readonly openInBrowserCommandType = `${manifest.PACKAGE_NAME}.openInBrowser`;

    constructor(
        private readonly context: vscode.ExtensionContext,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ContainerOpenInBrowser.openInBrowserCommandType, this.openContainerInBrowser.bind(this)),
        );
    }

    public async openContainerInBrowser(item: ContainerItem) {
        const commonWebPorts = [443, 80, 3000, 3001, 5001, 5000, 5002, 8000, 8080, 8081];
        const containerWebPorts = commonWebPorts.find(port => item.ports.some(p => p.startsWith(`${port}:`)));
        const publishedPorts = item.ports
            .filter(p => p.startsWith(`${containerWebPorts}:`))
            .map(p => p.split(':')[0]);
        if (publishedPorts.length === 0) {
            vscode.window.showWarningMessage('No common web port found for this container.');
            return;
        }
        const target = item.target;
        const url = `http://${target.host}:${publishedPorts[0]}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
    }

}
