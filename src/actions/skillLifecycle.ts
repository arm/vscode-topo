import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { createTask, runTask } from '../util/task';

const INSTALL_TASK_NAME = 'Install Topo Agent Skill';
const UNINSTALL_TASK_NAME = 'Uninstall Topo Agent Skill';

async function runSkillTask(
    taskName: string,
    execution: vscode.ShellExecution,
): Promise<void> {
    await runTask(createTask(taskName, execution));
    await vscode.commands.executeCommand(refreshSkillStatus);
}

export class SkillLifecycle {
    constructor(private readonly topoSkill: TopoSkill) {}

    public async installSkillCommandHandler(): Promise<void> {
        await runSkillTask(
            INSTALL_TASK_NAME,
            this.topoSkill.createInstallCommand(),
        );
    }

    public async uninstallSkillCommandHandler(): Promise<void> {
        await runSkillTask(
            UNINSTALL_TASK_NAME,
            this.topoSkill.createUninstallCommand(),
        );
    }
}
