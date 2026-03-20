import { ContainerItem, TargetItem } from '../util/types';
import { ContainerOpenInBrowser } from './containerOpenInBrowser';
import * as vscode from 'vscode';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { mock, MockProxy } from 'jest-mock-extended';

jest.mock('../util/logger');

describe('ContainerOpenInBrowser', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target: TargetItem = {
        id: 'topo',
        ssh: 'user@topo.local',
        host: 'topo.local',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
    });

    it('opens browser for common web port', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser(context);
        await containerOpenInBrowser.activate();
        const openInBrowser = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === ContainerOpenInBrowser.openInBrowserCommand,
        )![1];
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
            cpuUsage: '',
            memUsage: '',
        };
        const treeItem = new TargetTreeContainerItem(item);

        await openInBrowser(treeItem);

        const url = `http://${target.host}:8080`;
        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            vscode.Uri.parse(url),
        );
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows warning if no ports', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser(context);
        await containerOpenInBrowser.activate();
        const openInBrowser = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === ContainerOpenInBrowser.openInBrowserCommand,
        )![1];
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
            cpuUsage: '',
            memUsage: '',
        };
        const treeItem = new TargetTreeContainerItem(item);

        await openInBrowser(treeItem);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'No web ports found for container abc123',
        );
        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('shows warning if no common web port', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser(context);
        await containerOpenInBrowser.activate();
        const openInBrowser = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === ContainerOpenInBrowser.openInBrowserCommand,
        )![1];
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
            cpuUsage: '',
            memUsage: '',
        };
        const treeItem = new TargetTreeContainerItem(item);

        await openInBrowser(treeItem);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'No web ports found for container abc123',
        );
        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });
});
