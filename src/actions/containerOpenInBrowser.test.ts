import { Target } from '../workloadPlacement/target';
import { ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerOpenInBrowser } from './containerOpenInBrowser';
import * as vscode from 'vscode';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';
import { mock, MockProxy } from 'jest-mock-extended';

jest.mock('../util/logger');

describe('ContainerOpenInBrowser', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target = new Target('topo', 'user@topo.local');

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
        const port = '8080:80';
        const item = {
            id: 'abc123',
            ports: [port],
            state: 'running',
            target,
        } as ContainerItem;
        const treeItem = new TargetTreeContainerItem(item);

        await openInBrowser(treeItem);

        const publishedPort = port.split(':')[0];
        const url = `http://${target.host}:${publishedPort}`;
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
            ports: [],
            state: 'running',
            target,
            name: '',
            image: '',
            status: '',
            labels: '',
            runningFor: '',
            createdAt: '',
            runtime: '',
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
            ports: ['22:22'],
            state: 'running',
            target,
            name: '',
            image: '',
            status: '',
            labels: '',
            runningFor: '',
            createdAt: '',
            runtime: '',
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
