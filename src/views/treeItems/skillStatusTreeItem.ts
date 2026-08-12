import * as vscode from 'vscode';
import { TopoSkillAgentStatus } from '../../services/topoSkill';

const statusDescriptions: Record<TopoSkillAgentStatus['status'], string> = {
    installed: 'Up to date',
    outdated: 'Out of date',
};

export class SkillStatusTreeItem extends vscode.TreeItem {
    constructor(public readonly agent: TopoSkillAgentStatus) {
        super(agent.name, vscode.TreeItemCollapsibleState.None);
        this.description = statusDescriptions[agent.status];
        this.tooltip = `${agent.name} Topo Agent Skill: ${statusDescriptions[agent.status]}.\n${agent.paths.join('\n')}`;
        if (agent.status === 'installed') {
            this.iconPath = new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            );
        } else {
            this.iconPath = new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('list.warningForeground'),
            );
        }
    }
}
