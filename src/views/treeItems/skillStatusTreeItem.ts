import * as vscode from 'vscode';
import { TopoSkillStatus } from '../../util/types';

const statusDescriptions: Record<TopoSkillStatus, string> = {
    installed: 'Up to date',
    missing: 'Not installed',
    outdated: 'Out of date',
};

export class SkillStatusTreeItem extends vscode.TreeItem {
    constructor(public readonly status: TopoSkillStatus) {
        super('Topo Agent Skill', vscode.TreeItemCollapsibleState.None);
        if (status === 'installed') {
            this.tooltip = `Topo Agent Skill: ${statusDescriptions[status]}. Helps compatible AI assistants locate and use the Topo CLI.`;
            this.iconPath = new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            );
            this.contextValue = 'TopoSkillUninstallAvailable';
        } else {
            this.description = statusDescriptions[status];
            this.tooltip = `Topo Agent Skill: ${statusDescriptions[status]}. Install the bundled version to give compatible AI assistants current guidance for locating and using the Topo CLI.`;
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'TopoSkillInstallAvailable';
            if (status === 'outdated') {
                this.contextValue += ' TopoSkillUninstallAvailable';
            }
        }
    }
}
