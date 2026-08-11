import * as vscode from 'vscode';
import { SkillStatusTreeItem } from './skillStatusTreeItem';

describe('SkillStatusTreeItem', () => {
    it('represents an up-to-date skill with a green check', () => {
        const item = new SkillStatusTreeItem('installed');

        expect(item).toMatchObject({
            label: 'Topo Agent Skill',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'TopoSkillUninstallAvailable',
            iconPath: new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        });
        expect(item.description).toBeUndefined();
        expect(item.tooltip).toBe(
            'Topo Agent Skill: Up to date. Helps compatible AI assistants locate and use the Topo CLI.',
        );
    });

    it.each([
        ['missing', 'Not installed', 'TopoSkillInstallAvailable'],
        [
            'outdated',
            'Out of date',
            'TopoSkillInstallAvailable TopoSkillUninstallAvailable',
        ],
    ] as const)(
        'represents the %s status',
        (status, expectedDescription, expectedContextValue) => {
            const item = new SkillStatusTreeItem(status);

            expect(item).toMatchObject({
                label: 'Topo Agent Skill',
                description: expectedDescription,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextValue: expectedContextValue,
                iconPath: new vscode.ThemeIcon('info'),
            });
            expect(item.tooltip).toContain(expectedDescription);
        },
    );
});
