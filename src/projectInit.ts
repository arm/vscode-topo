import * as manifest from './manifest';
import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { TargetStore } from './workloadPlacement/targetStore';

type ProjectInitializerBinary = Pick<TopoCli, 'init'>;

export class ProjectInit {

    public static initProjectCommand = `${manifest.PACKAGE_NAME}.initProject`;

    constructor(
        private readonly context: Pick<vscode.ExtensionContext, 'subscriptions'>,
        private readonly topoCli: Pick<ProjectInitializerBinary, 'init'>,
        private readonly targetStore: Pick<TargetStore, 'getSelectedTarget'>,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ProjectInit.initProjectCommand, this.initProject.bind(this))
        );
    }

    private async initProject(): Promise<void> {
        try {
            const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!projectPath) {
                vscode.window.showErrorMessage('No workspace folder is open. Please open a folder to initialize the project.');
                return;
            }
            const selectedTarget = await this.targetStore.getSelectedTarget();
            if (!selectedTarget) {
                vscode.window.showErrorMessage('No target selected. Please select a target before initializing the project.');
                return;
            }
            await this.topoCli.init(projectPath, selectedTarget.ssh);
            vscode.window.showInformationMessage(`Project initialized successfully.`);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to initialize project: ${errorMsg}`);
        }
    }

}
