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

    it('opens the only published endpoint without prompting', async () => {
        const action = new OpenContainerInBrowser();

        await action.openContainerInBrowserCommandHandler(
            new ContainerTreeItem({
                ...container,
                address: 'target.local:5432',
            }),
        );

        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse('http://target.local:5432'),
        );
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('prompts for a port when multiple endpoints are published', async () => {
        const action = new OpenContainerInBrowser();
        const selected = {
            label: 'Port 8080',
            description: 'http://target.local:8080',
            endpoint: {
                port: 8080,
                url: 'http://target.local:8080',
            },
        };
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(selected);

        await action.openContainerInBrowserCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
            [
                selected,
                {
                    label: 'Port 80',
                    description: 'http://target.local:80',
                    endpoint: {
                        port: 80,
                        url: 'http://target.local:80',
                    },
                },
            ],
            { placeHolder: 'Select a port to open in the browser' },
        );
        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse('http://target.local:8080'),
        );
    });

    it('does nothing when port selection is cancelled', async () => {
        const action = new OpenContainerInBrowser();
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

        await action.openContainerInBrowserCommandHandler(
            new ContainerTreeItem(container),
        );

        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('rejects containers without a published port', async () => {
        const action = new OpenContainerInBrowser();
        const treeItem = new ContainerTreeItem({
            ...container,
            address: 'target.local',
        });

        await expect(
            action.openContainerInBrowserCommandHandler(treeItem),
        ).rejects.toThrow('Container abc123 has no published ports');

        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('rejects stopped containers with a published port', async () => {
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
