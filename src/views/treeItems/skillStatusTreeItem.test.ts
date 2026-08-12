import * as vscode from 'vscode';
import { SkillStatusTreeItem } from './skillStatusTreeItem';

describe('SkillStatusTreeItem', () => {
    it('represents an up-to-date skill with a green check', () => {
        const item = new SkillStatusTreeItem('codex', 'installed');

        expect(item).toMatchObject({
            label: 'Codex',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'TopoSkillAgent',
            iconPath: new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        });
        expect(item.description).toBeUndefined();
        expect(item.tooltip).toBe(
            'Codex Topo Agent Skill: Up to date. Helps Codex locate and use the Topo CLI.',
        );
    });

    it.each([
        ['missing', 'Not installed'],
        ['outdated', 'Out of date'],
    ] as const)('represents the %s status', (status, expectedDescription) => {
        const item = new SkillStatusTreeItem('claude-code', status);

        expect(item).toMatchObject({
            label: 'Claude Code',
            description: expectedDescription,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'TopoSkillAgent',
            iconPath: new vscode.ThemeIcon('info'),
        });
        expect(item.tooltip).toContain(expectedDescription);
    });
});
