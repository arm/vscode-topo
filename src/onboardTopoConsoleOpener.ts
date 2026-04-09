import * as manifest from './manifest';
import * as vscode from 'vscode';

export class OnBoardTopoConsoleOpener {

    public static openTopoConsoleCommand = `${manifest.PACKAGE_NAME}.openTopoConsole`;

    constructor(
    private readonly context: vscode.ExtensionContext,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(OnBoardTopoConsoleOpener.openTopoConsoleCommand, this.openTopoConsole.bind(this))
        );
    }

    private async openTopoConsole(): Promise<void> {
        try {
            await vscode.env.openExternal(vscode.Uri.parse(manifest.BOARD_HOST_URL));
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to open board console: ${errorMsg}`);
        }
    }

}
