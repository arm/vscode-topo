import * as vscode from 'vscode';
import { refreshSkillStatus } from '../commandIds';
import { TopoSkill } from '../services/topoSkill';
import { createProcessTask } from '../util/task';
import { TaskExecutor } from '../util/taskExecutor';

export function createInstallSkillTask(skillSourcePath: string): vscode.Task {
    const args = ['skills', 'add', skillSourcePath, '--global'];
    return createProcessTask('Install Topo skill', ['npx', ...args], {
        definition: {
            type: 'process',
            command: 'npx',
            args,
        },
    });
}

export class InstallSkill {
    constructor(
        private readonly topoSkill: TopoSkill,
        private readonly taskExecutor: TaskExecutor,
    ) {}

    public async installSkillCommandHandler(): Promise<void> {
        const task = createInstallSkillTask(
            this.topoSkill.bundledDirectoryPath,
        );
        await this.taskExecutor.run(task);
        await this.topoSkill.verifyInstallation();
        await vscode.commands.executeCommand(refreshSkillStatus);
        vscode.window.showInformationMessage(
            'Topo CLI location skill installed. Start a new agent session to check it out.',
        );
    }
}
