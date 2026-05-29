import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';
import { PACKAGE_NAME } from './manifest';
import * as vscode from 'vscode';
import { logger } from './util/logger';
import { DisposableCollector } from './util/disposableCollector';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHostHealth = command('refreshHostHealth');
export const showOutput = command('showOutput');
export const selectTarget = command('selectTarget');
export const removeTarget = command('removeTarget');
export const addTarget = command('addTarget');
export const inspectHostHealth = command('inspectHostHealth');

export function register(
    hostController: HostController,
    targetController: TargetController,
): vscode.Disposable {
    const disposables = new DisposableCollector();
    disposables.collect(
        vscode.commands.registerCommand(refreshHostHealth, () =>
            hostController.refreshHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(showOutput, () => logger.show()),
        vscode.commands.registerCommand(selectTarget, (treeNode) =>
            targetController.selectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(removeTarget, (treeNode) =>
            targetController.removeCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(addTarget, () =>
            targetController.addCommandHandler(),
        ),
        vscode.commands.registerCommand(inspectHostHealth, () =>
            hostController.openHealthDocumentCommandHandler(),
        ),
    );

    return disposables;
}
