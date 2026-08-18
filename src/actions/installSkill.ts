import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { runTask } from '../util/task';

export class InstallSkill {
    constructor(private readonly topoSkill: TopoSkill) {}

    public async installSkillCommandHandler(): Promise<void> {
        await runTask(this.topoSkill.createInstallTask());
        await vscode.commands.executeCommand(refreshSkillStatus);
    }
}
