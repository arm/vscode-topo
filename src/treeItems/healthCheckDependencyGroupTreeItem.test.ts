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
        const item = new HealthCheckDependencyGroupTreeItem(dependencies, true);

        expect(item.label).toBe('Dependencies');
        expect(item.contextValue).toBe('Dependencies');
        expect(item.dependencies).toBe(dependencies);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
    });

    it('sets loading icon when loading', () => {
        const item = new HealthCheckDependencyGroupTreeItem([], true);

        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('loading~spin');
    });
});
