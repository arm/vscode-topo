import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { createTask, runTask } from '../util/task';

const INSTALL_TASK_NAME = 'Install Topo Agent Skill';

export class InstallSkill {
    constructor(private readonly topoSkill: TopoSkill) {}

    public async installSkillCommandHandler(): Promise<void> {
        const execution = this.topoSkill.createInstallCommand();
        await runTask(createTask(INSTALL_TASK_NAME, execution));
        await vscode.commands.executeCommand(refreshSkillStatus);
    }
}
