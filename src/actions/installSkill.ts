import os from 'node:os';
import * as vscode from 'vscode';
import { showAndLogError } from '../util/showAndLog';

const SKILL_NAME = 'topo-cli-location';

export class InstallSkill {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly userHomeUri = vscode.Uri.file(os.homedir()),
    ) {}

    public async installSkillCommandHandler(): Promise<void> {
        try {
            await installSkill(this.extensionUri, this.userHomeUri);
        } catch (error) {
            showAndLogError(
                'Failed to install the Topo CLI location skill',
                error,
            );
        }
    }
}

export async function installSkill(
    extensionUri: vscode.Uri,
    userHomeUri: vscode.Uri,
): Promise<void> {
    const sourceUri = vscode.Uri.joinPath(extensionUri, 'skills', SKILL_NAME);
    const skillsUri = vscode.Uri.joinPath(userHomeUri, '.agents', 'skills');
    const destinationUri = vscode.Uri.joinPath(skillsUri, SKILL_NAME);

    await vscode.workspace.fs.createDirectory(skillsUri);
    await vscode.workspace.fs.copy(sourceUri, destinationUri, {
        overwrite: true,
    });
    vscode.window.showInformationMessage(
        'Topo CLI location skill installed. Start a new agent session if it is not available immediately.',
    );
}
