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
            iconPath: new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        });
        expect(item.contextValue).toBeUndefined();
    });

    it.each([
        ['missing', 'Not installed', vscode.TreeItemCollapsibleState.None],
        ['outdated', 'Out of date', vscode.TreeItemCollapsibleState.Expanded],
    ] as const)(
        'represents the %s aggregate status',
        (status, description, collapsibleState) => {
            const item = new SkillGroupTreeItem(report(status));

            expect(item).toMatchObject({
                description,
                collapsibleState,
                contextValue: 'TopoSkillInstallAvailable',
            });
        },
    );
});
