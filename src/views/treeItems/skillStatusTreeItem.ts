import * as vscode from 'vscode';
import { TopoSkillStatus } from '../../util/types';

const statusDescriptions: Record<TopoSkillStatus, string> = {
    installed: 'Up to date',
    missing: 'Not installed',
    outdated: 'Out of date',
};

export class SkillStatusTreeItem extends vscode.TreeItem {
    constructor(public readonly status: TopoSkillStatus) {
        super('Topo CLI skills', vscode.TreeItemCollapsibleState.None);
        if (status === 'installed') {
            this.tooltip = `Topo CLI skills: ${statusDescriptions[status]}`;
            this.iconPath = new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            );
        } else {
            this.description = statusDescriptions[status];
            this.tooltip = `Topo CLI skills: ${statusDescriptions[status]}. Install the bundled skill to make it available to coding agents.`;
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'TopoSkillInstallAvailable';
        }
    }
}
