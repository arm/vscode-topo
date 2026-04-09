import * as manifest from './manifest';
import * as vscode from 'vscode';
import * as path from 'path';
import { TopoCli } from './topoCli';

type MakefileGeneratorBinary = Pick<TopoCli, 'generateMakefile'>;

export class MakefileGenerator {

    public static generateMakefileCommand = `${manifest.PACKAGE_NAME}.generateMakefile`;

    constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly topoCli: MakefileGeneratorBinary,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                MakefileGenerator.generateMakefileCommand,
                this.generateMakefile.bind(this)
            ),
            vscode.commands.registerCommand(
                `${MakefileGenerator.generateMakefileCommand}.context`,
                this.generateMakefileFromContext.bind(this)
            )
        );
    }

    private async generateMakefile(fileUri?: vscode.Uri): Promise<void> {
        let composeFilePath: string | undefined;
        if (fileUri && fileUri.fsPath) {
            composeFilePath = fileUri.fsPath;
        } else {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders
                    ? vscode.workspace.workspaceFolders[0].uri
                    : undefined,
                openLabel: 'Select compose file folder'
            });
            if (!folderUri || folderUri.length === 0) {
                return;
            }
            composeFilePath = path.join(folderUri[0].fsPath, manifest.BOARD_DEFAULT_COMPOSE_FILE);
        }
        try {
            await this.topoCli.generateMakefile(composeFilePath);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to generate Makefile: ${errorMsg}`);
        }
    }

    private async generateMakefileFromContext(fileUri: vscode.Uri): Promise<void> {
        return this.generateMakefile(fileUri);
    }
}
