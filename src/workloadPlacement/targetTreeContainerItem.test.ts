import * as vscode from 'vscode';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { Target } from './target';
import { BOARD_AMBIENT_RUNTIME } from '../manifest';
import { ContainerItem } from '../util/types';

describe('TargetTreeContainerItem', () => {
    const target = new Target('topo', 'user@topo.local');
    it('should set label (image), description (name - uptime), tooltip, contextValue, command, and iconPath', () => {
        const container: ContainerItem = {
            id: 'id123',
            name: 'my-container',
            image: 'nginx:latest',
            state: 'running',
            status: 'Up',
            labels: 'label1=value1',
            runningFor: '10m',
            runtime: BOARD_AMBIENT_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: { '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }] },
            cpuUsage: '2.5%',
            memUsage: '0B / 1GiB',
            target,
        };
        const item = new TargetTreeContainerItem(container);
        expect(item.label).toBe('nginx:latest');
        expect(item.description).toBe('my-container - 10m');
        expect(item.tooltip).toContain('id123');
        expect(item.tooltip).toContain('nginx:latest');
        expect(item.tooltip).toContain('my-container');
        expect(item.tooltip).toContain('label1=value1');
        expect(item.tooltip).toContain('10m');
        expect(item.subsystem).toBe('Ambient');
        expect(item.contextValue).toBe('service running Ambient');

        // Check iconPath for running status
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe(
            'debug-breakpoint-log',
        );
        expect((item.iconPath as vscode.ThemeIcon).color).toEqual({
            id: 'terminal.ansiGreen',
        });
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
            runtime: BOARD_AMBIENT_RUNTIME,
            annotations: {},
            createdAt: '',
            ports: {},
            cpuUsage: '0.0%',
            memUsage: '0B / 1GiB',
            target,
        };
        const item = new TargetTreeContainerItem(container);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe(
            'debug-breakpoint-log',
        );
        expect((item.iconPath as vscode.ThemeIcon).color).toEqual({
            id: 'terminal.ansiWhite',
        });
    });
});
