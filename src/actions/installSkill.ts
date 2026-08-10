import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';

export class InstallSkill {
    constructor(private readonly topoSkill: TopoSkill) {}

    public async installSkillCommandHandler(): Promise<void> {
        await this.topoSkill.install();
        await vscode.commands.executeCommand(refreshSkillStatus);
        vscode.window.showInformationMessage(
            'Topo CLI location skill installed for Codex and Claude Code. Start a new agent session to check it out.',
        );
    }
}
