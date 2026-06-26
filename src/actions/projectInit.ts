import * as vscode from 'vscode';
import { TopoCli } from '../services/topoCli';

export class ProjectInit {
    constructor(private readonly topoCli: TopoCli) {}

    public async initProjectCommandHandler(): Promise<void> {
        const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!projectPath) {
            vscode.window.showErrorMessage(
                'No workspace folder is open. Please open a folder to initialize the project.',
            );
            return;
        }
        await initProject(this.topoCli, projectPath);
    }
}

export async function initProject(
    topoCli: TopoCli,
    projectPath: string,
): Promise<void> {
    try {
        await topoCli.init(projectPath);
        vscode.window.showInformationMessage(
            `Project initialized successfully.`,
        );
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
            `Failed to initialize project: ${errorMsg}`,
        );
    }
}
