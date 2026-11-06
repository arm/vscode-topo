import * as vscode from 'vscode';
import { ContainerTreeItem } from './containerTreeItem';
import { ContainerItem } from '../../util/types';

describe('ContainerTreeItem', () => {
    const target = 'user@topo.local';
    it('shows the container name and status with image and ID in the tooltip', () => {
        const container: ContainerItem = {
            id: 'id123',
            names: 'my-container',
            image: 'nginx:latest',
            state: 'running',
            status: 'Up 10 minutes',
            processingDomain: 'Remoteproc',
            address: 'topo.local:4121',
            target,
            service: 'app',
            composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
        };
        const item = new ContainerTreeItem(container);
        expect(item.label).toBe('my-container');
        expect(item.description).toBe('Up 10 minutes');
        expect(item.tooltip).toContain('id123');
        expect(item.tooltip).toContain('nginx:latest');
        expect(item.tooltip).toContain('my-container');
        expect(item.tooltip).toContain('Remoteproc');
        expect(item.tooltip).toContain('topo.local:4121');
        expect(item.tooltip).toContain('Service: app');
        expect(item.contextValue).toBe('container running Remoteproc browser');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'debug-breakpoint-log',
                new vscode.ThemeColor('terminal.ansiGreen'),
            ),
        );
    });

    it('should set correct iconPath for stopped container', () => {
        const container: ContainerItem = {
            id: 'id456',
            names: 'stopped-container',
            image: 'nginx',
            state: 'exited',
            status: 'Exited (0) 2 days ago',
            processingDomain: 'Remoteproc',
            address: 'topo.local:4121',
            target,
            service: 'app',
            composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
        };
        const item = new ContainerTreeItem(container);
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'debug-breakpoint-log-unverified',
                new vscode.ThemeColor('terminal.ansiWhite'),
            ),
        );
    });

    it('marks running containers with a published port as browser-openable', () => {
        const container: ContainerItem = {
            id: 'id789',
            names: 'web-container',
            image: 'nginx',
            state: 'running',
            status: 'Up 10 minutes',
            processingDomain: 'Linux Host',
            address: 'topo.local:8080',
            target,
            service: 'app',
            composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
        };

        const item = new ContainerTreeItem(container);

        expect(item.contextValue).toBe('container running Linux Host browser');
    });

    it('does not mark running containers without a published port as browser-openable', () => {
        const container: ContainerItem = {
            id: 'id000',
            names: 'no-port-container',
            image: 'nginx',
            state: 'running',
            status: 'Up 10 minutes',
            processingDomain: 'Linux Host',
            address: 'topo.local',
            target,
            service: 'app',
            composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
        };

        const item = new ContainerTreeItem(container);

        expect(item.contextValue).toBe('container running Linux Host');
    });

    it('does not mark stopped containers as browser-openable', () => {
        const container: ContainerItem = {
            id: 'id987',
            names: 'stopped-web-container',
            image: 'nginx',
            state: 'exited',
            status: 'Exited (0)',
            processingDomain: 'Linux Host',
            address: 'topo.local:80',
            target,
            service: 'app',
            composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
        };

        const item = new ContainerTreeItem(container);

        expect(item.contextValue).toBe('container exited Linux Host');
    });

    it('uses the ID and state when a container has no name or status', () => {
        const item = new ContainerTreeItem({
            id: 'id123',
            names: '',
            image: 'nginx',
            state: 'running',
            status: '',
            processingDomain: 'Linux Host',
            address: '',
            target,
            service: 'app',
            composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
        });

        expect(item.label).toBe('id123');
        expect(item.description).toBe('running');
    });
});
