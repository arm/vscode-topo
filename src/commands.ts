import { HostController } from './controllers/hostController';
import { PACKAGE_NAME } from './manifest';
import * as vscode from 'vscode';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHostHealth = command('refreshHostHealth');

export function register(hostController: HostController): vscode.Disposable {
    const disposables = [
        vscode.commands.registerCommand(refreshHostHealth, () =>
            hostController.refreshHealth(),
        ),
    ];

    return {
        dispose: () => {
            for (const disposable of [...disposables].reverse()) {
                disposable.dispose();
            }
        },
    };
}
