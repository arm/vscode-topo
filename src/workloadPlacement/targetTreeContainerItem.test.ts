import * as vscode from 'vscode';
import { TargetTreeContainerItem } from './targetTreeContainerItem';
import { Target } from './target';

describe('TargetTreeContainerItem', () => {
    const target = new Target(
        'topo',
        'user@topo.local',
    );
    it('should set label (image), description (name - uptime), tooltip, contextValue, command, and iconPath', () => {
        const item = new TargetTreeContainerItem(
            'id123',
            'my-container',
            'running',
            'Up 2 days',
            'label1=value1',
            '10m',
            'nginx:latest',
            '',
            'io.containerd.runtime',
            ['8080:80'],
            '2.5%',
            '0B / 1GiB',
            target,
        );
        expect(item.label).toBe('nginx:latest');
        expect(item.description).toBe('my-container - 10m');
        expect(item.tooltip).toContain('id123');
        expect(item.tooltip).toContain('nginx:latest');
        expect(item.tooltip).toContain('my-container');
        expect(item.tooltip).toContain('label1=value1');
        expect(item.tooltip).toContain('10m');
        expect(item.subsystem).toBe('Ambient');
        expect(item.contextValue).toBe('service running Ambient');
        expect(item.ports).toEqual(['8080:80']);

        // Check iconPath for running status
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('debug-breakpoint-log');
        expect((item.iconPath as vscode.ThemeIcon).color).toEqual({ id: 'terminal.ansiGreen' });
    });

    it('should set correct iconPath for stopped container', () => {
        const item = new TargetTreeContainerItem(
            'id456',
            'stopped-container',
            'exited',
            'Up 2 days',
            'label2=value2',
            '5m',
            'ubuntu:22.04',
            '',
            'io.containerd.runtime',
            [],
            '2.5%',
            '0B / 1GiB',
            target,
        );
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('debug-breakpoint-log');
        expect((item.iconPath as vscode.ThemeIcon).color).toEqual({ id: 'terminal.ansiWhite' });
    });
});
