import * as vscode from 'vscode';
import { HealthCheckGroupTreeItem } from './healthCheckGroupTreeItem';
import { loaded, loading } from '../../util/loadable';
import type { HealthCheck } from '../../services/topoCliSchema';

describe('HealthCheckGroupTreeItem', () => {
    it('sets group metadata for health checks', () => {
        const healthChecks: HealthCheck[] = [
            {
                name: 'Container Engine',
                location: 'target',
                status: 'ok',
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
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
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
                    location: 'target',
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
