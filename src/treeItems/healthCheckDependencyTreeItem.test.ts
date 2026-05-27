import * as vscode from 'vscode';
import { HealthCheckDependencyTreeItem } from './healthCheckDependencyTreeItem';

describe('HealthCheckDependencyTreeItem', () => {
    it('sets label and description', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'ok',
        });

        expect(item.label).toBe('Container Engine');
        expect(item.description).toBe('docker');
    });

    it('sets icon and context value for an ok dependency', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'ok',
        });

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('check');
        expect(item.contextValue).toBe('Dependency Ok');
    });

    it('sets icon and context value for a dependency with a warning', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'warning',
        });

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('warning');
        expect(item.contextValue).toBe('Dependency Warning');
    });

    it('sets icon and context value for a dependency with an error', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'missing',
            status: 'error',
        });

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('close');
        expect(item.contextValue).toBe('Dependency Error');
    });

    it('marks dependency with an executable fix command as fixable', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'missing',
            status: 'warning',
            fix: {
                description: 'Install the container engine',
                command: 'topo install container-engine --target ssh://imx93',
            },
        });

        expect(item.contextValue).toBe('Dependency Warning Fixable');
    });

    it('does not mark healthy remoteproc dependencies as fixable', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Remoteproc Runtime',
            value: 'installed',
            status: 'ok',
        });

        expect(item.contextValue).toBe('Dependency Ok');
    });
});
