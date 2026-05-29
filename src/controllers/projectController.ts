import * as vscode from 'vscode';
import { showAndLogError } from '../util/showAndLogError';
import { TopoCli } from '../topoCli';
import * as projectUtil from '../util/project';
import { TargetModel } from '../models/targetModel';

export class ProjectController {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public async stopCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose file selected for stop');
        }
        const target = this.targetModel.selected;

        if (!target) {
            showAndLogError(
                'Error executing stop command',
                new Error(
                    'No target selected. Please select a target before stopping.',
                ),
            );
            return;
        }

        await projectUtil.stop(resource.fsPath, target);
    }

    public async initCommandHandler(): Promise<void> {
        const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!projectPath) {
            vscode.window.showErrorMessage(
                'No workspace folder is open. Please open a folder to initialize the project.',
            );
            return;
        }
        await projectUtil.initProject(this.topoCli, projectPath);
    }

    public async deployCommandHandler(resource?: vscode.Uri): Promise<void> {
        if (!resource) {
            throw new Error('No compose file selected for deployment');
        }
        const target = this.targetModel.selected;

        if (!target) {
            showAndLogError(
                'Error executing deploy command',
                new Error(
                    'No target selected. Please select a target before deploying.',
                ),
            );
            return;
        }

        await projectUtil.deploy(resource.fsPath, target);
    }
}
