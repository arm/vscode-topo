import * as vscode from 'vscode';
import { HealthCheckGroupTreeItem } from './healthCheckGroupTreeItem';
import { loaded, loading } from '../../util/loadable';

describe('HealthCheckGroupTreeItem', () => {
    it('sets group metadata for health checks', () => {
        const healthChecks = [
            {
                name: 'Container Engine',
                status: 'ok' as const,
                value: 'docker',
            },
        ];
        const item = new HealthCheckGroupTreeItem(loaded(healthChecks));

        expect(item.label).toBe('Health');
        expect(item.contextValue).toBe('Health');
        expect(item.healthChecks).toBe(healthChecks);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        expect(item.iconPath).toStrictEqual(new vscode.ThemeIcon('library'));
    });

    it('sets loading icon when loading', () => {
        const item = new HealthCheckGroupTreeItem(loading(loaded([])));

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });

    it('marks the group fixable when a health check has an executable fix command', () => {
        const item = new HealthCheckGroupTreeItem(
            loaded([
                {
                    name: 'Container Engine',
                    status: 'error',
                    value: 'missing',
                    fix: {
                        description: 'Install container engine',
                        command: 'topo install container-engine',
                    },
                },
            ]),
        );

        expect(item.contextValue).toBe('Health HasFixableIssues');
    });
});
