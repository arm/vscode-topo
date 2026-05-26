import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';
import { PACKAGE_NAME } from './manifest';
import * as vscode from 'vscode';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHostHealth = command('refreshHostHealth');
export const selectTarget = command('selectTarget');
export const removeTarget = command('removeTarget');
export const addTarget = command('addTarget');

export function register(
    hostController: HostController,
    targetController: TargetController,
): vscode.Disposable {
    const disposables = [
        vscode.commands.registerCommand(refreshHostHealth, () =>
            hostController.refreshHealth(),
        ),
        vscode.commands.registerCommand(selectTarget, (treeNode) =>
            targetController.select(treeNode),
        ),
        vscode.commands.registerCommand(removeTarget, (treeNode) =>
            targetController.remove(treeNode),
        ),
        vscode.commands.registerCommand(addTarget, () =>
            targetController.promptToAdd(),
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
