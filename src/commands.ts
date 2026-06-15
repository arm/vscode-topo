import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';
import { PACKAGE_NAME } from './manifest';
import * as vscode from 'vscode';
import { logger } from './util/logger';
import { DisposableCollector } from './util/disposableCollector';
import { ProjectInit } from './actions/projectInit';
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { OpenContainerShell } from './actions/openContainerShell';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerDelete } from './actions/containerDelete';
import { FixIssue } from './actions/fixIssue';
import { ProjectClone } from './actions/projectClone';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHostHealth = command('refreshHostHealth');
export const refreshTargetData = command('refreshTargetData');
export const showOutput = command('showOutput');
export const selectTarget = command('selectTarget');
export const resetExtensionData = command('resetExtensionData');
export const unselectTarget = command('unselectTarget');
export const initProject = command('initProject');
export const deploy = command('deploy');
export const deployContext = command('deploy.context');
export const stop = command('stop.context');
export const openContainerShell = command('openContainerShell');
export const startContainer = command('startContainer');
export const stopContainer = command('stopContainer');
export const deleteContainer = command('deleteContainer');
export const fixDependencyIssue = command('fixDependencyIssue');
export const fixTargetIssues = command('fixTargetIssues');
export const remoteClone = command('remoteClone');
export const localClone = command('localClone');
export const templateClone = command('templateClone');

export interface CommandHandlers {
    hostController: HostController;
    targetController: TargetController;
    projectInit: ProjectInit;
    projectClone: ProjectClone;
    deploy: Deploy;
    stop: Stop;
    openContainerShell: OpenContainerShell;
    containerStart: ContainerStart;
    containerStop: ContainerStop;
    containerDelete: ContainerDelete;
    fixIssue: FixIssue;
}

export function register(handlers: CommandHandlers): vscode.Disposable {
    const disposables = new DisposableCollector();
    disposables.collect(
        vscode.commands.registerCommand(refreshHostHealth, () =>
            handlers.hostController.refreshHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(refreshTargetData, () =>
            handlers.targetController.refreshSelectedTargetDataCommandHandler(),
        ),
        vscode.commands.registerCommand(showOutput, () => logger.show()),
        vscode.commands.registerCommand(selectTarget, () =>
            handlers.targetController.selectCommandHandler(),
        ),
        vscode.commands.registerCommand(resetExtensionData, () =>
            handlers.targetController.resetExtensionDataCommandHandler(),
        ),
        vscode.commands.registerCommand(unselectTarget, (treeNode) =>
            handlers.targetController.unselectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(initProject, () =>
            handlers.projectInit.initProjectCommandHandler(),
        ),
        vscode.commands.registerCommand(deploy, () =>
            handlers.deploy.deployCommandHandler(),
        ),
        vscode.commands.registerCommand(
            deployContext,
            (resource?: vscode.Uri) =>
                handlers.deploy.deployContextCommandHandler(resource),
        ),
        vscode.commands.registerCommand(stop, (resource?: vscode.Uri) =>
            handlers.stop.stopCommandHandler(resource),
        ),
        vscode.commands.registerCommand(openContainerShell, (treeNode) =>
            handlers.openContainerShell.openContainerShellCommandHandler(
                treeNode,
            ),
        ),
        vscode.commands.registerCommand(startContainer, (treeNode) =>
            handlers.containerStart.startContainerCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(stopContainer, (treeNode) =>
            handlers.containerStop.stopContainerCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(deleteContainer, (treeNode) =>
            handlers.containerDelete.deleteContainerCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(fixDependencyIssue, (treeNode) =>
            handlers.fixIssue.fixIssueCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(fixTargetIssues, (treeNode) =>
            handlers.fixIssue.fixIssueCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(remoteClone, () =>
            handlers.projectClone.remoteCloneCommandHandler(),
        ),
        vscode.commands.registerCommand(localClone, () =>
            handlers.projectClone.localCloneCommandHandler(),
        ),
        vscode.commands.registerCommand(templateClone, () =>
            handlers.projectClone.templateCloneCommandHandler(),
        ),
    );

    return disposables;
}
