import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import {
    TopoSkill,
    TopoSkillAgent,
    TOPO_SKILL_AGENT_LABELS,
    TOPO_SKILL_AGENTS,
} from '../services/topoSkill';
import { execFile } from '../util/exec';

interface AgentQuickPickItem extends vscode.QuickPickItem {
    agent: TopoSkillAgent;
}

export class InstallSkill {
    constructor(
        private readonly topoSkill: TopoSkill,
        private readonly platform = process.platform,
    ) {}

    public async installSkillCommandHandler(
        agent?: TopoSkillAgent,
    ): Promise<void> {
        const agents = agent ? [agent] : await this.pickAgents();
        if (agents.length === 0) {
            return;
        }

        const npx = this.platform === 'win32' ? 'npx.cmd' : 'npx';
        const args = [
            '--yes',
            'skills',
            'add',
            this.topoSkill.bundledDirectoryPath,
            '--global',
            '--agent',
            ...agents,
            '--yes',
        ];
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Installing Topo agent skill…',
            },
            async () => {
                await execFile(npx, args, {
                    cwd: this.topoSkill.userHomePath,
                    encoding: 'utf8',
                    windowsHide: true,
                });
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
