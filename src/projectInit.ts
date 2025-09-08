import * as manifest from './manifest';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';

type ProjectInitializerBinary = Pick<TopoCli, 'initProject'>;

export class ProjectInit {

    public static initProjectCommand = `${manifest.PACKAGE_NAME}.initProject`;

    constructor(
        private readonly context: vscode.ExtensionContext,
    private readonly topoCli: ProjectInitializerBinary,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ProjectInit.initProjectCommand, this.initProject.bind(this))
        );
    }

    private async initProject(): Promise<void> {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders[0].uri
                : undefined,
            openLabel: 'Select the project folder'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const projectPath = folderUri[0].fsPath;

        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter the project name',
            value: 'example-project'
        });
        if (!projectName) {
            return;
        }
        try {
            await this.topoCli.initProject(projectPath, projectName);
            vscode.window.showInformationMessage(`Project "${projectName}" initialized successfully.`);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to initialize project: ${errorMsg}`);
        }
    }

}
