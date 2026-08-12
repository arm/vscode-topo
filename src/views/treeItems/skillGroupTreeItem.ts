import * as vscode from 'vscode';
import { TopoSkillStatuses } from '../../services/topoSkill';
import { Loadable } from '../../util/loadable';

export class SkillGroupTreeItem extends vscode.TreeItem {
    constructor(public readonly skillStatuses: Loadable<TopoSkillStatuses>) {
        super('Topo Agent Skills', vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'TopoAgentSkills';
        if (skillStatuses.loading) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        } else if (
            skillStatuses.status === 'loaded' &&
            Object.values(skillStatuses.data).some(
                (status) => status === 'installed',
            )
        ) {
            this.iconPath = new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            );
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
