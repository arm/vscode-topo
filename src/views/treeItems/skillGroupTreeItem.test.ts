import * as vscode from 'vscode';
import { TopoSkillReport, TopoSkillStatus } from '../../services/topoSkill';
import { SkillGroupTreeItem } from './skillGroupTreeItem';

describe('SkillGroupTreeItem', () => {
    function report(status: TopoSkillStatus): TopoSkillReport {
        return {
            status,
            agents:
                status === 'missing'
                    ? []
                    : [
                          {
                              name: 'Claude Code',
                              paths: ['/fake/skill'],
                              status,
                          },
                      ],
        };
    }

    it('represents current installations as an expanded group', () => {
        const item = new SkillGroupTreeItem(report('installed'));

        expect(item).toMatchObject({
            label: 'Topo Agent Skill',
            description: '1 agent',
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextValue: 'TopoSkillUninstallAvailable',
            iconPath: new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        });
    });

    it('represents a missing installation', () => {
        const item = new SkillGroupTreeItem(report('missing'));

        expect(item).toMatchObject({
            description: 'Not installed',
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'TopoSkillInstallAvailable',
        });
    });

    it('represents an outdated installation', () => {
        const item = new SkillGroupTreeItem(report('outdated'));

        expect(item).toMatchObject({
            description: 'Out of date',
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextValue:
                'TopoSkillInstallAvailable TopoSkillUninstallAvailable',
        });
    });
});
