import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import {
    TopoSkill,
    TopoSkillAgent,
    TOPO_SKILL_AGENT_LABELS,
    TOPO_SKILL_AGENTS,
} from '../services/topoSkill';
import { NpxSkills } from '../services/npxSkills';

interface AgentQuickPickItem extends vscode.QuickPickItem {
    agent: TopoSkillAgent;
}

export class InstallSkill {
    constructor(
        private readonly topoSkill: TopoSkill,
        private readonly npxSkills: NpxSkills,
    ) {}

    public async installSkillCommandHandler(
        agent?: TopoSkillAgent,
    ): Promise<void> {
        const agents = agent ? [agent] : await this.pickAgents();
        if (agents.length === 0) {
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Installing Topo agent skill…',
            },
            async () => {
                await this.npxSkills.add(
                    this.topoSkill.bundledDirectoryPath,
                    agents,
                );
            },
        );
        await vscode.commands.executeCommand(refreshSkillStatus);
        if (!(await this.topoSkill.areAgentsInstalled(agents))) {
            return;
        }
        vscode.window.showInformationMessage(
            'Topo CLI location skill installed. Start a new agent session to check it out.',
        );
    }

    private async pickAgents(): Promise<TopoSkillAgent[]> {
        const selected = await vscode.window.showQuickPick<AgentQuickPickItem>(
            TOPO_SKILL_AGENTS.map((agent) => ({
                agent,
                label: TOPO_SKILL_AGENT_LABELS[agent],
                description: this.topoSkill.getInstallationDirectoryPath(agent),
                picked: true,
            })),
            {
                canPickMany: true,
                placeHolder: 'Select one or more agents',
                title: 'Install Topo Agent Skill',
            },
        );
        return selected?.map(({ agent }) => agent) ?? [];
    }
}
