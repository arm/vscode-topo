import * as vscode from 'vscode';
import { HealthCheckDependencyGroupTreeItem } from './healthCheckDependencyGroupTreeItem';

describe('HealthCheckDependencyGroupTreeItem', () => {
    it('uses a neutral icon when all entries are healthy', () => {
        const item = new HealthCheckDependencyGroupTreeItem([
            { name: 'Container Engine', status: 'ok', value: 'docker' },
        ]);

        expect(item.label).toBe('Dependencies');
        expect(item.contextValue).toBe('Dependencies');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('library');
        expect(icon.color).toBeUndefined();
    });

    it('uses a warning icon if at least one entry has a warning', () => {
        const item = new HealthCheckDependencyGroupTreeItem([
            { name: 'Container Engine', status: 'ok', value: 'docker' },
            { name: 'Something Else', status: 'warning', value: 'foobar' },
        ]);

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('warning');
    });

    it('uses an error icon if at least one entry has an error', () => {
        const item = new HealthCheckDependencyGroupTreeItem([
            { name: 'Container Engine', status: 'ok', value: 'docker' },
            { name: 'Something Else', status: 'warning', value: 'foobar' },
            { name: 'Subsystem Driver', status: 'error', value: 'missing' },
        ]);

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('close');
    });
});
