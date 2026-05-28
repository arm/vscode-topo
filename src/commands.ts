import { HostController } from './controllers/hostController';
import { ProjectController } from './controllers/projectController';
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
export const initProject = command('initProject');
export const deploy = command('deploy.context');
export const stop = command('stop.context');

export function register(
    hostController: HostController,
    targetController: TargetController,
    projectController: ProjectController,
): vscode.Disposable {
    const disposables = new DisposableCollector();
    disposables.collect(
        vscode.commands.registerCommand(refreshHostHealth, () =>
            hostController.refreshHealth(),
        ),
        vscode.commands.registerCommand(showOutput, () => logger.show()),
        vscode.commands.registerCommand(selectTarget, (treeNode) =>
            targetController.select(treeNode),
        ),
        vscode.commands.registerCommand(removeTarget, (treeNode) =>
            targetController.remove(treeNode),
        ),
        vscode.commands.registerCommand(addTarget, () =>
            targetController.promptToAdd(),
        ),
        vscode.commands.registerCommand(inspectHostHealth, () =>
            hostController.openHealthDocument(),
        ),
        vscode.commands.registerCommand(initProject, () =>
            projectController.initProject(),
        ),
        vscode.commands.registerCommand(deploy, (resource?: vscode.Uri) =>
            projectController.deploy(resource),
        ),
        vscode.commands.registerCommand(stop, (resource?: vscode.Uri) =>
            projectController.stop(resource),
        ),
    );

    return disposables;
}
