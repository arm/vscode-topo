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
            'Topo CLI location skill installed. Start a new agent session to check it out',
        );
    }

    public async uninstallSkillCommandHandler(): Promise<void> {
        await this.topoSkill.uninstall();
        await this.hostController.refreshSkillStatus();
        vscode.window.showInformationMessage(
            'Topo CLI location skill uninstalled. Start a new agent session for the change to take effect',
        );
    }
}
