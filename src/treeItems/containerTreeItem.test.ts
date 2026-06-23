import * as vscode from 'vscode';
import { ContainerTreeItem } from './containerTreeItem';
import { TARGET_HOST_RUNTIME, TARGET_REMOTEPROC_RUNTIME } from '../manifest';
import { ContainerItem } from '../util/types';

describe('ContainerTreeItem', () => {
    const target = 'user@topo.local';
    it('should set label (image), description (name - uptime), tooltip, contextValue, command, and iconPath', () => {
        const container: ContainerItem = {
            id: 'id123',
            name: 'my-container',
            image: 'nginx:latest',
            state: 'running',
            status: 'Up',
            labels: 'label1=value1',
            runningFor: '10m',
            runtime: TARGET_REMOTEPROC_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: { '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }] },
            target,
        };
        const item = new ContainerTreeItem(container);
        expect(item.label).toBe('nginx:latest');
        expect(item.description).toBe('my-container - 10m');
        expect(item.tooltip).toContain('id123');
        expect(item.tooltip).toContain('nginx:latest');
        expect(item.tooltip).toContain('my-container');
        expect(item.tooltip).toContain('label1=value1');
        expect(item.tooltip).toContain('10m');
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
            name: 'stopped-container',
            image: 'nginx',
            state: 'exited',
            status: 'Exited (0) 2 days ago',
            labels: '',
            runningFor: '',
            runtime: TARGET_REMOTEPROC_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: {},
            target,
        };
        const item = new ContainerTreeItem(container);
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'debug-breakpoint-log',
                new vscode.ThemeColor('terminal.ansiWhite'),
            ),
        );
    });

    it('uses PrimaryOS context for containers running in the primary OS', () => {
        const container: ContainerItem = {
            id: 'id789',
            name: 'primary-os-container',
            image: 'alpine',
            state: 'running',
            status: 'Up',
            labels: '',
            runningFor: '1m',
            runtime: TARGET_HOST_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: {},
            target,
        };

        const item = new ContainerTreeItem(container);

        expect(item.contextValue).toBe('service running PrimaryOS');
    });
});
