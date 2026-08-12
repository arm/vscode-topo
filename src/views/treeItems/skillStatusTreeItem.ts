import * as vscode from 'vscode';
import {
    TopoSkillAgent,
    TOPO_SKILL_AGENT_LABELS,
} from '../../services/topoSkill';
import { TopoSkillStatus } from '../../util/types';

const statusDescriptions: Record<TopoSkillStatus, string> = {
    installed: 'Up to date',
    missing: 'Not installed',
    outdated: 'Out of date',
};

export class SkillStatusTreeItem extends vscode.TreeItem {
    constructor(
        public readonly agent: TopoSkillAgent,
        public readonly status: TopoSkillStatus,
    ) {
        const agentLabel = TOPO_SKILL_AGENT_LABELS[agent];
        super(agentLabel, vscode.TreeItemCollapsibleState.None);
        if (status === 'installed') {
            this.tooltip = `${agentLabel} Topo Agent Skill: ${statusDescriptions[status]}. Helps ${agentLabel} locate and use the Topo CLI.`;
            this.iconPath = new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            );
        } else {
            this.contextValue = 'TopoSkillAgent';
            this.description = statusDescriptions[status];
            this.tooltip = `${agentLabel} Topo Agent Skill: ${statusDescriptions[status]}. Install the bundled version to give ${agentLabel} current guidance for locating and using the Topo CLI.`;
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
