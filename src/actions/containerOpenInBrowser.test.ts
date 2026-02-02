import { Target } from '../workloadPlacement/target';
import {
    ContainersManager,
    ContainerItem,
} from '../workloadPlacement/containersManager';
import { ContainerOpenInBrowser } from './containerOpenInBrowser';
import vscode from 'vscode';
import { TargetTreeContainerItem } from '../workloadPlacement/targetTreeContainerItem';

jest.mock('../util/logger');

describe('ContainerOpenInBrowser', () => {
    let containersManager: jest.Mocked<
        Pick<ContainersManager, 'getContainersData' | 'stopContainer'>
    >;
    let context: Pick<vscode.ExtensionContext, 'subscriptions'>;
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);
    const target = new Target('topo', 'user@topo.local');
    const mockContainer: ContainerItem = {
        id: 'abc123',
        name: 'mock',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '',
        createdAt: '',
        runtime: '',
        ports: ['8080:80', '1234:1234'],
        cpuUsage: '',
        memUsage: '',
        target,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        containersManager = {
            getContainersData: jest.fn(),
            stopContainer: jest.fn(),
        };
        context = { subscriptions: [] };
    });

    it('opens browser for common web port', async () => {
        containersManager.getContainersData.mockResolvedValue([mockContainer]);
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
        const item = {
            id: 'abc123',
            ports: [],
            state: 'running',
            target,
        } as unknown as ContainerItem;
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
