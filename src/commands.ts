import { HostController } from './controllers/hostController';
import { TargetsController } from './controllers/targetsController';
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
    targetsController: TargetsController,
): vscode.Disposable {
    const disposables = [
        vscode.commands.registerCommand(refreshHostHealth, () =>
            hostController.refreshHealth(),
        ),
        vscode.commands.registerCommand(selectTarget, (treeNode) =>
            targetsController.selectTarget(treeNode),
        ),
        vscode.commands.registerCommand(removeTarget, (treeNode) =>
            targetsController.removeTarget(treeNode),
        ),
        vscode.commands.registerCommand(addTarget, () =>
            targetsController.promptToAddTarget(),
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
