import * as vscode from 'vscode';
import { TopoSkillReport } from '../../services/topoSkill';

export class SkillGroupTreeItem extends vscode.TreeItem {
    constructor(public readonly report: TopoSkillReport) {
        super(
            'Topo Agent Skill',
            report.agents.length > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None,
        );

        switch (report.status) {
            case 'installed':
                this.description = `${report.agents.length} ${report.agents.length === 1 ? 'agent' : 'agents'}`;
                this.tooltip =
                    'Topo Agent Skill: Up to date. Helps compatible AI assistants locate and use the Topo CLI.';
                this.iconPath = new vscode.ThemeIcon(
                    'check',
                    new vscode.ThemeColor('testing.iconPassed'),
                );
                break;
            case 'outdated':
                this.description = 'Out of date';
                this.tooltip =
                    'Topo Agent Skill: Out of date. Install the bundled version to give compatible AI assistants current guidance for locating and using the Topo CLI.';
                this.iconPath = new vscode.ThemeIcon(
                    'warning',
                    new vscode.ThemeColor('list.warningForeground'),
                );
                this.contextValue = 'TopoSkillInstallAvailable';
                break;
            case 'missing':
                this.description = 'Not installed';
                this.tooltip =
                    'Topo Agent Skill: Not installed. Install the bundled version to help compatible AI assistants locate and use the Topo CLI.';
                this.iconPath = new vscode.ThemeIcon('info');
                this.contextValue = 'TopoSkillInstallAvailable';
                break;
        }
    }
}
