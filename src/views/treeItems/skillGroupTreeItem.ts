import * as vscode from 'vscode';
import { TopoSkillStatusLoadables } from '../../models/hostModel';

export class SkillGroupTreeItem extends vscode.TreeItem {
    constructor(public readonly skillStatuses: TopoSkillStatusLoadables) {
        super('Topo Agent Skills', vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'TopoAgentSkills';
        const statuses = Object.values(skillStatuses);
        if (statuses.some(({ loading }) => loading)) {
            this.iconPath = new vscode.ThemeIcon('loading~spin');
        } else if (
            statuses.some(
                (status) =>
                    status.status === 'loaded' && status.data === 'installed',
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
