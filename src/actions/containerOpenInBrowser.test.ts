import { BOARD_HOST_URL } from '../manifest';
import { ContainersManager, ContainerItem } from '../workloadPlacement/containersManager';
import { ContainerOpenInBrowser } from './containerOpenInBrowser';
import vscode from 'vscode';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('ContainerOpenInBrowser', () => {
    let containersManager: jest.Mocked<ContainersManager>;
    let context: any;
    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;

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
    };

    beforeEach(() => {
        jest.clearAllMocks();
        containersManager = {
            getContainersData: jest.fn(),
            stopContainer: jest.fn()
        } as any;
        context = { subscriptions: [] };
    });

    it('opens browser for common web port', async () => {
        containersManager.getContainersData.mockResolvedValue([mockContainer]);
        const containerOpenInBrowser = new ContainerOpenInBrowser(context);
        await containerOpenInBrowser.activate();
        const openInBrowser = registerCommandMock.mock.calls.find(
            ([cmd]: [string, any]) => cmd === 'containerExplorer.openInBrowser'
        )?.[1];
        const port = '8080:80';
        const item = { id: 'abc123', ports: [port] } as ContainerItem;
  
        await openInBrowser(item);

        const publishedPort = port.split(':')[0];
        const url = `${BOARD_HOST_URL}:${publishedPort}`;
        expect(vscode.env.openExternal).toHaveBeenCalledWith(vscode.Uri.parse(url));
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows warning if no ports', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser(context);
        await containerOpenInBrowser.activate();
        const openInBrowser = registerCommandMock.mock.calls.find(
            ([cmd]: [string, any]) => cmd === 'containerExplorer.openInBrowser'
        )?.[1];
        const item = { id: 'abc123', ports: [] } as unknown as ContainerItem;

        await openInBrowser(item);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No common web port found for this container.');
        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });

    it('shows warning if no common web port', async () => {
        const containerOpenInBrowser = new ContainerOpenInBrowser(context);
        await containerOpenInBrowser.activate();
        const openInBrowser = registerCommandMock.mock.calls.find(
            ([cmd]: [string, any]) => cmd === 'containerExplorer.openInBrowser'
        )?.[1];
        const item = { id: 'abc123', ports: ['22:22'] } as ContainerItem;

        await openInBrowser(item);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No common web port found for this container.');
        expect(vscode.env.openExternal).not.toHaveBeenCalled();
    });
});
