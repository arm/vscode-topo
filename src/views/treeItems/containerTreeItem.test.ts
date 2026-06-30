import * as vscode from 'vscode';
import { ContainerTreeItem } from './containerTreeItem';
import { ContainerItem } from '../../util/types';

describe('ContainerTreeItem', () => {
    const target = 'user@topo.local';
    it('should set label (image), description (name - status), tooltip, contextValue, command, and iconPath', () => {
        const container: ContainerItem = {
            id: 'id123',
            names: 'my-container',
            image: 'nginx:latest',
            state: 'running',
            status: 'Up 10 minutes',
            processingDomain: 'Remoteproc',
            address: 'topo.local:4121',
            target,
        };
        const item = new ContainerTreeItem(container);
        expect(item.label).toBe('nginx:latest');
        expect(item.description).toBe('my-container - Up 10 minutes');
        expect(item.tooltip).toContain('id123');
        expect(item.tooltip).toContain('nginx:latest');
        expect(item.tooltip).toContain('my-container');
        expect(item.tooltip).toContain('Remoteproc');
        expect(item.tooltip).toContain('topo.local:4121');
        expect(item.contextValue).toBe('service running Remoteproc');
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
        };
        const item = new ContainerTreeItem(container);
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'debug-breakpoint-log-unverified',
                new vscode.ThemeColor('terminal.ansiWhite'),
            ),
        );
    });
});
