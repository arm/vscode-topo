import * as vscode from 'vscode';
import { ContainerGroupItem, ContainerTreeItem } from './containerTreeItems';

describe('ContainerGroupItem', () => {
    it('should set label and contextValue', () => {
        const item = new ContainerGroupItem('Host');
        expect(item.label).toBe('Host');
        expect(item.contextValue).toBe('containerGroup');
        expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });
});

describe('ContainerTreeItem', () => {
    it('should set label (image), description (name - uptime), tooltip, contextValue, command, and iconPath', () => {
        const item = new ContainerTreeItem(
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
        );
        expect(item.label).toBe('nginx:latest');
        expect(item.description).toBe('my-container - 10m');
        expect(item.tooltip).toContain('id123');
        expect(item.tooltip).toContain('nginx:latest');
        expect(item.tooltip).toContain('my-container');
        expect(item.tooltip).toContain('label1=value1');
        expect(item.tooltip).toContain('10m');
        expect(item.subsystem).toBe('Ambient');
        expect(item.contextValue).toBe('running Ambient');
        expect(item.ports).toEqual(['8080:80']);

        // Check iconPath for running status
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('debug-breakpoint-log');
        expect((item.iconPath as vscode.ThemeIcon).color).toEqual({ name: 'terminal.ansiGreen' });
    });

    it('should set correct iconPath for stopped container', () => {
        const item = new ContainerTreeItem(
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
        );
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('debug-breakpoint-log');
        expect((item.iconPath as vscode.ThemeIcon).color).toEqual({ name: 'terminal.ansiWhite' });
    });
});
