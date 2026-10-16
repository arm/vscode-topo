import * as vscode from 'vscode';
import type { HealthCheck } from '../../services/topoCliSchema';
import { HealthCapabilityTreeItem } from './healthCapabilityTreeItem';
import { loaded } from '../../util/loadable';

describe('HealthCapabilityTreeItem', () => {
    it('shows the capability name and health status', () => {
        const healthChecks: HealthCheck[] = [
            {
                name: 'Container Engine',
                location: 'target',
                status: 'ok',
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

    it('keeps fix actions on individual checks', () => {
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
                    status: 'warning',
                    value: 'missing',
                },
            ]),
            'Deployment',
        );

        expect(item.contextValue).toBeUndefined();
        const children = item.getChildren();
        expect(children.find(({ label }) => label === 'Zed')).toMatchObject({
            contextValue: 'HealthCheck Warning Fixable',
        });
        expect(children.find(({ label }) => label === 'Alpha')).toMatchObject({
            contextValue: 'HealthCheck Warning',
        });
    });
});
