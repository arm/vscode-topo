import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { TaskExecutor } from '../util/taskExecutor';

export class InstallSkill {
    constructor(
        private readonly topoSkill: TopoSkill,
        private readonly taskExecutor: TaskExecutor,
    ) {}

    public async installSkillCommandHandler(): Promise<void> {
        await this.taskExecutor.run(this.topoSkill.createInstallTask());
        await vscode.commands.executeCommand(refreshSkillStatus);
    }
}
