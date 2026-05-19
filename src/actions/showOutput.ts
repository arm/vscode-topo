import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { logger } from '../util/logger';

export class ShowOutput implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    public static readonly showOutputCommand = `${manifest.PACKAGE_NAME}.showOutput`;

    public activate() {
        this.disposables.push(
            vscode.commands.registerCommand(ShowOutput.showOutputCommand, () =>
                logger.show(),
            ),
        );
    }

    public dispose() {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
