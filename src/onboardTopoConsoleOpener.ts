import * as manifest from './manifest';
import * as vscode from 'vscode';
import { TargetStore } from './workloadPlacement/targetStore';

export class OnBoardTopoConsoleOpener {
    public static openTopoConsoleCommand = `${manifest.PACKAGE_NAME}.openTopoConsole`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetStore: TargetStore,
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                OnBoardTopoConsoleOpener.openTopoConsoleCommand,
                this.openTopoConsole.bind(this),
            ),
        );
    }

    private async openTopoConsole(): Promise<void> {
        const target = await this.targetStore.getSelectedTarget();
        if (!target) {
            vscode.window.showErrorMessage(
                'No target selected, cannot open board console',
            );
            return;
        }
        try {
            await vscode.env.openExternal(
                vscode.Uri.parse(`http://${target.host}`),
            );
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(
                `Failed to open board console: ${errorMsg}`,
            );
        }
    }
}
