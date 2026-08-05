import * as vscode from 'vscode';
import { HostController } from '../controllers/hostController';
import { TopoSkill } from '../services/topoSkill';

export class InstallSkill {
    constructor(
        private readonly topoSkill: TopoSkill,
        private readonly hostController: HostController,
    ) {}

    public async installSkillCommandHandler(): Promise<void> {
        await this.topoSkill.install();
        await this.hostController.refreshSkillStatus();
        vscode.window.showInformationMessage(
            'Topo CLI location skill installed. Start a new agent session if it is not available immediately.',
        );
    }
}
