import * as vscode from 'vscode';
import { TargetModel } from '../models/targetModel';

export class ConnectViaSSH {
    constructor(private readonly targetModel: TargetModel) {}

    public connectViaSSHCommandHandler(): void {
        const target = this.targetModel.selected;
        if (!target) {
            throw new Error('No selected target found');
        }

        connectViaSSH(target);
    }
}

export function connectViaSSH(target: string): void {
    const terminal = vscode.window.createTerminal({
        name: `SSH: ${target}`,
        shellPath: 'ssh',
        shellArgs: [target],
    });
    terminal.show();
}
