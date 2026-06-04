import { ContainerItem } from '../util/types';
import { ContainerOpenInBrowser } from './containerOpenInBrowser';
import * as vscode from 'vscode';
import { TargetContainerTreeItem } from '../targetTreeView/targetContainerTreeItem';

vi.mock('../util/logger');

describe('ContainerOpenInBrowser', () => {
    const target = 'user@topo.local';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens browser for common web port', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser();
        const item: ContainerItem = {
            id: 'abc123',
            ports: { '8080/tcp': [{ HostPort: '8080', HostIp: '0.0.0.0' }] },
            state: 'running',
            target,
            name: '',
            image: '',
            status: '',
            labels: '',
            runningFor: '',
            createdAt: '',
            runtime: '',
            annotations: {},
        };
        const treeItem = new TargetContainerTreeItem(item);

        await containerOpenInBrowser.openInBrowserCommandHandler(treeItem);

        const url = `http://${target}:8080`;
        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse(url),
        );
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows warning if no ports', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser();
        const item: ContainerItem = {
            id: 'abc123',
            ports: {},
            state: 'running',
            target,
            name: '',
            image: '',
            status: '',
            labels: '',
            runningFor: '',
            createdAt: '',
            runtime: '',
            annotations: {},
        };
        const treeItem = new TargetContainerTreeItem(item);

        await containerOpenInBrowser.openInBrowserCommandHandler(treeItem);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'No web ports found for container abc123',
        );
        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('shows warning if no common web port', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser();
        const item: ContainerItem = {
            id: 'abc123',
            ports: { '22/tcp': [{ HostPort: '22', HostIp: '0.0.0.0' }] },
            state: 'running',
            target,
            name: '',
            image: '',
            status: '',
            labels: '',
            runningFor: '',
            createdAt: '',
            runtime: '',
            annotations: {},
        };
        const treeItem = new TargetContainerTreeItem(item);

        await containerOpenInBrowser.openInBrowserCommandHandler(treeItem);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'No web ports found for container abc123',
        );
        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });
});
