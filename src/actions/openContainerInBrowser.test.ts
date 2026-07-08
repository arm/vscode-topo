import * as vscode from 'vscode';
import { OpenContainerInBrowser } from './openContainerInBrowser';
import { ContainerTreeItem } from '../views/treeItems/containerTreeItem';
import { ContainerItem } from '../util/types';

describe('OpenContainerInBrowser', () => {
    const container: ContainerItem = {
        id: 'abc123',
        names: 'web',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        processingDomain: 'Linux Host',
        address: 'target.local:8080, target.local:80',
        target: 'user@target.local',
    };

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('opens the highest-priority web endpoint externally', async () => {
        const action = new OpenContainerInBrowser();

        await action.openContainerInBrowserCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse('http://target.local:80'),
        );
    });

    it('rejects containers without a likely web endpoint', async () => {
        const action = new OpenContainerInBrowser();
        const treeItem = new ContainerTreeItem({
            ...container,
            address: 'target.local:5432',
        });

        await expect(
            action.openContainerInBrowserCommandHandler(treeItem),
        ).rejects.toThrow('Container abc123 has no likely web endpoint');

        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('rejects stopped containers with a web endpoint', async () => {
        const action = new OpenContainerInBrowser();
        const treeItem = new ContainerTreeItem({
            ...container,
            state: 'exited',
        });

        await expect(
            action.openContainerInBrowserCommandHandler(treeItem),
        ).rejects.toThrow('Container abc123 is not running');

        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });
});
