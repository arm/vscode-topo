import * as vscode from 'vscode';
import { HealthCheckTreeItem } from './healthCheckTreeItem';
import { loaded } from '../util/loadable';

describe('HealthCheckTreeItem', () => {
    it('sets label and description', () => {
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Container Engine',
                value: 'docker',
                status: 'ok',
            }),
        );

        expect(item.label).toBe('Container Engine');
        expect(item.description).toBe('docker');
    });

    it('sets context value and icon for an ok health check', () => {
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Container Engine',
                value: 'docker',
                status: 'ok',
            }),
        );

        expect(item.contextValue).toBe('HealthCheck Ok');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
    });

    it('sets context value and icon for a health check with a warning', () => {
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Container Engine',
                value: 'docker',
                status: 'warning',
            }),
        );

        expect(item.contextValue).toBe('HealthCheck Warning');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('testing.iconQueued'),
            ),
        );
    });

    it('sets context value and icon for a health check with an error', () => {
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Container Engine',
                value: 'missing',
                status: 'error',
            }),
        );

        expect(item.contextValue).toBe('HealthCheck Error');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'close',
                new vscode.ThemeColor('testing.iconFailed'),
            ),
        );
    });

    it('marks health check with an executable fix command as fixable', () => {
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Container Engine',
                value: 'missing',
                status: 'warning',
                fix: {
                    description: 'Install the container engine',
                    command:
                        'topo install container-engine --target ssh://imx93',
                },
            }),
        );

        expect(item.contextValue).toBe('HealthCheck Warning Fixable');
    });

    it('does not mark healthy remoteproc health checks as fixable', () => {
        const item = new HealthCheckTreeItem(
            loaded({
                name: 'Remoteproc Runtime',
                value: 'installed',
                status: 'ok',
            }),
        );

        expect(item.contextValue).toBe('HealthCheck Ok');
    });

    it('uses a spinning icon when loading', () => {
        const item = new HealthCheckTreeItem(
            loaded(
                {
                    name: 'Connectivity',
                    value: 'Checking target connectivity',
                    status: 'warning',
                },
                true,
            ),
        );

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });
});
