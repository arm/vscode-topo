import * as vscode from 'vscode';
import { getContainerWebEndpoints } from '../util/getContainerWebEndpoints';
import type { ContainerWebEndpoint } from '../util/getContainerWebEndpoints';
import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';

type EndpointQuickPickItem = vscode.QuickPickItem & {
    endpoint: ContainerWebEndpoint;
};

export class OpenContainerInBrowser {
    public async openContainerInBrowserCommandHandler(
        treeNode: unknown,
    ): Promise<void> {
        assertContainerTreeItem(treeNode);
        if (treeNode.containerItem.state !== 'running') {
            throw new Error(
                `Container ${treeNode.containerItem.id} is not running`,
            );
        }

        const endpoints = getContainerWebEndpoints(
            treeNode.containerItem.address,
        );
        if (endpoints.length === 0) {
            throw new Error(
                `Container ${treeNode.containerItem.id} has no published ports`,
            );
        }

        let [endpoint] = endpoints;
        if (endpoints.length > 1) {
            const items: EndpointQuickPickItem[] = endpoints.map(
                (candidate) => ({
                    label: `Port ${candidate.port}`,
                    description: candidate.url,
                    endpoint: candidate,
                }),
            );
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a port to open in the browser',
            });
            if (!selected) {
                return;
            }
            endpoint = selected.endpoint;
        }

        await vscode.env.openExternal(vscode.Uri.parse(endpoint.url));
    }
}
