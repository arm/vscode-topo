import * as vscode from 'vscode';
import { TargetTreeDependencyGroupItem } from './targetTreeDependencyGroupItem';

describe('TargetTreeDependencyGroupItem', () => {
    it('uses a neutral icon when all entries are healthy', () => {
        const item = new TargetTreeDependencyGroupItem([
            { name: 'Container Engine', healthy: true, value: 'docker' },
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

    it('uses a warning icon if at least one entry is not healthy', () => {
        const item = new TargetTreeDependencyGroupItem([
            { name: 'Container Engine', healthy: true, value: 'docker' },
            { name: 'Subsystem Driver', healthy: false, value: 'missing' },
        ]);

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('warning');
    });
});
