import * as vscode from 'vscode';
import { HealthCapabilityTreeItem } from './healthCapabilityTreeItem';
import { loaded } from '../../util/loadable';

describe('HealthCapabilityTreeItem', () => {
    it('shows the capability name and health status', () => {
        const healthChecks = [
            {
                name: 'Container Engine',
                location: 'target' as const,
                status: 'ok' as const,
                value: 'docker',
            },
        ];
        const item = new HealthCapabilityTreeItem(
            loaded(healthChecks),
            'Deployment',
        );

        expect(item.label).toBe('Deployment');
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

    it('preserves check order and keeps fix actions on individual checks', () => {
        const item = new HealthCapabilityTreeItem(
            loaded([
                {
                    name: 'Zed',
                    location: 'host',
                    status: 'warning',
                    value: 'missing',
                    fix: {
                        description: 'Install Zed',
                        command: 'topo install zed --target ssh://imx93',
                    },
                },
                {
                    name: 'Alpha',
                    location: 'host',
                    status: 'ok',
                    value: 'installed',
                },
            ]),
            'Deployment',
        );

        expect(item.contextValue).toBeUndefined();
        expect(item.getChildren()).toMatchObject([
            {
                label: 'Zed',
                contextValue: 'HealthCheck Warning Fixable',
            },
            { label: 'Alpha' },
        ]);
    });
});
