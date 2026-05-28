import * as manifest from '../manifest';
import * as vscode from 'vscode';
import { TopoCli } from '../topoCli';
import { DisposableCollector } from '../util/disposableCollector';

export class ProjectInit implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();
    public static initProjectCommand = `${manifest.PACKAGE_NAME}.initProject`;

    constructor(private readonly topoCli: TopoCli) {}

    public activate() {
        this.disposables.collect(
            vscode.commands.registerCommand(
                ProjectInit.initProjectCommand,
                this.initProject.bind(this),
            ),
        );
    }

    private async initProject(): Promise<void> {
        try {
            const projectPath =
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!projectPath) {
                vscode.window.showErrorMessage(
                    'No workspace folder is open. Please open a folder to initialize the project.',
                );
                return;
            }
            await this.topoCli.init(projectPath);
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

    public dispose(): void {
        this.disposables.dispose();
    }
}
