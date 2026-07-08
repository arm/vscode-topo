import * as vscode from 'vscode';
import { getContainerWebUrl } from '../util/getContainerWebUrl';
import { assertContainerTreeItem } from '../views/treeItems/assertContainerTreeItem';

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

        const url = getContainerWebUrl(treeNode.containerItem.address);
        if (!url) {
            throw new Error(
                `Container ${treeNode.containerItem.id} has no likely web endpoint`,
            );
        }

        await vscode.env.openExternal(vscode.Uri.parse(url));
    }
}
