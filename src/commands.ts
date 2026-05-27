import { HostController } from './controllers/hostController';
import { PACKAGE_NAME } from './manifest';
import * as vscode from 'vscode';
import { logger } from './util/logger';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHostHealth = command('refreshHostHealth');
export const showOutput = command('showOutput');
export const inspectHostHealth = command('inspectHostHealth');

export function register(hostController: HostController): vscode.Disposable {
    const disposables = [
        vscode.commands.registerCommand(refreshHostHealth, () =>
            hostController.refreshHealth(),
        ),
        vscode.commands.registerCommand(showOutput, () => logger.show()),
        vscode.commands.registerCommand(inspectHostHealth, () =>
            hostController.openHealthDocument(),
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
