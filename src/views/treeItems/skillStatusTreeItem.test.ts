import * as vscode from 'vscode';
import { TopoSkillAgentStatus } from '../../services/topoSkill';
import { SkillStatusTreeItem } from './skillStatusTreeItem';

describe('SkillStatusTreeItem', () => {
    function agent(
        status: TopoSkillAgentStatus['status'],
    ): TopoSkillAgentStatus {
        return {
            name: 'Claude Code',
            paths: ['/fake/home/.claude/skills/topo-cli-location'],
            status,
        };
    }

    it('represents an up-to-date agent installation', () => {
        const item = new SkillStatusTreeItem(agent('installed'));

        expect(item).toMatchObject({
            label: 'Claude Code',
            description: 'Up to date',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        });
        expect(item.tooltip).toContain(
            '/fake/home/.claude/skills/topo-cli-location',
        );
    });

    it('represents an outdated agent installation', () => {
        const item = new SkillStatusTreeItem(agent('outdated'));

        expect(item).toMatchObject({
            label: 'Claude Code',
            description: 'Out of date',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('list.warningForeground'),
            ),
        });
    });
});
