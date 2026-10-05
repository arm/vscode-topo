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
        expect(item.contextValue).toBeUndefined();
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
});
