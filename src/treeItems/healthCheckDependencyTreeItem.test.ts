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

    it('sets context value and icon for an ok dependency', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'ok',
        });

        expect(item.contextValue).toBe('Dependency Ok');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
    });

    it('sets context value and icon for a dependency with a warning', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'warning',
        });

        expect(item.contextValue).toBe('Dependency Warning');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('testing.iconQueued'),
            ),
        );
    });

    it('sets context value and icon for a dependency with an error', () => {
        const item = new HealthCheckDependencyTreeItem({
            name: 'Container Engine',
            value: 'missing',
            status: 'error',
        });

        expect(item.contextValue).toBe('Dependency Error');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'close',
                new vscode.ThemeColor('testing.iconFailed'),
            ),
        );
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

    it('uses a spinning icon when loading', () => {
        const item = new HealthCheckDependencyTreeItem(
            {
                name: 'Connectivity',
                value: 'Checking target connectivity',
                status: 'warning',
            },
            { loading: true },
        );

        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('loading~spin');
    });
});
