import fs from 'node:fs';
import os from 'node:os';
import * as vscode from 'vscode';
import { showAndLogError } from '../util/showAndLog';

const SKILL_NAME = 'topo';
const REPLACE_ACTION = 'Replace';

export class InstallSkill {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly userHomeUri = vscode.Uri.file(os.homedir()),
    ) {}

    public async installSkillCommandHandler(): Promise<void> {
        try {
            await installSkill(this.extensionUri, this.userHomeUri);
        } catch (error) {
            showAndLogError('Failed to install the Topo skill', error);
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

    if (fs.existsSync(destinationUri.fsPath)) {
        const response = await vscode.window.showWarningMessage(
            'The Topo skill is already installed. Replace it with the bundled version?',
            { modal: true },
            REPLACE_ACTION,
        );
        if (response !== REPLACE_ACTION) {
            return;
        }
    }

    await vscode.workspace.fs.createDirectory(skillsUri);
    await vscode.workspace.fs.copy(sourceUri, destinationUri, {
        overwrite: true,
    });
    vscode.window.showInformationMessage(
        'Topo skill installed. Start a new agent session if it is not available immediately.',
    );
}
