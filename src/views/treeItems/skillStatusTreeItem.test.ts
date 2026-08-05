import * as vscode from 'vscode';
import { SkillStatusTreeItem } from './skillStatusTreeItem';

describe('SkillStatusTreeItem', () => {
    it('represents an up-to-date skill with a green check', () => {
        const item = new SkillStatusTreeItem('installed');

        expect(item).toMatchObject({
            label: 'Topo CLI skills',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        });
        expect(item.contextValue).toBeUndefined();
        expect(item.description).toBeUndefined();
        expect(item.tooltip).toBe('Topo CLI skills: Up to date');
    });

    it.each([
        ['missing', 'Not installed'],
        ['outdated', 'Out of date'],
    ] as const)('represents the %s status', (status, expectedDescription) => {
        const item = new SkillStatusTreeItem(status);

        expect(item).toMatchObject({
            label: 'Topo CLI skills',
            description: expectedDescription,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'TopoSkillInstallAvailable',
            iconPath: new vscode.ThemeIcon('info'),
        });
        expect(item.tooltip).toContain(expectedDescription);
    });
});
