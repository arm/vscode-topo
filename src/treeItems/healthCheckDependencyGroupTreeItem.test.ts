import * as vscode from 'vscode';
import { HealthCheckDependencyGroupTreeItem } from './healthCheckDependencyGroupTreeItem';

describe('HealthCheckDependencyGroupTreeItem', () => {
    it('sets group metadata for dependencies', () => {
        const dependencies = [
            {
                name: 'Container Engine',
                status: 'ok' as const,
                value: 'docker',
            },
        ];
        const item = new HealthCheckDependencyGroupTreeItem(dependencies);

        expect(item.label).toBe('Dependencies');
        expect(item.contextValue).toBe('Dependencies');
        expect(item.dependencies).toBe(dependencies);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
    });
});
