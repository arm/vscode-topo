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
import { ProjectController } from './controllers/projectController';
import { OpenSettings } from './actions/openSettings';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

export const refreshHostHealth = command('refreshHostHealth');
export const refreshProjects = command('refreshProjects');
export const refreshTargetData = command('refreshTargetData');
export const showOutput = command('showOutput');
export const selectTarget = command('selectTarget');
export const resetExtensionData = command('resetExtensionData');
export const clearTargetSelection = command('clearTargetSelection');
export const openSettings = command('openSettings');
export const initProject = command('initProject');
export const cloneProject = command('cloneProject');
export const deploy = command('deploy');
export const deployContext = command('deploy.context');
export const deployProject = command('deployProject');
export const stop = command('stop.context');
export const stopProject = command('stopProject');
export const openContainerShell = command('openContainerShell');
export const startContainer = command('startContainer');
export const stopContainer = command('stopContainer');
export const deleteContainer = command('deleteContainer');
export const fixIssue = command('fixIssue');
export const fixTargetIssues = command('fixTargetIssues');
export const remoteClone = command('remoteClone');
export const localClone = command('localClone');

export interface CommandHandlers {
    hostController: HostController;
    projectController: ProjectController;
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
    openSettings: OpenSettings;
}

export function register(handlers: CommandHandlers): vscode.Disposable {
    const disposables = new DisposableCollector();
    disposables.collect(
        vscode.commands.registerCommand(refreshHostHealth, () =>
            handlers.hostController.refreshHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(refreshProjects, () =>
            handlers.projectController.refreshProjects(),
        ),
        vscode.commands.registerCommand(refreshTargetData, () =>
            handlers.targetController.refreshSelectedTargetHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(showOutput, () => logger.show()),
        vscode.commands.registerCommand(selectTarget, () =>
            handlers.targetController.selectCommandHandler(),
        ),
        vscode.commands.registerCommand(resetExtensionData, () =>
            handlers.targetController.resetExtensionDataCommandHandler(),
        ),
        vscode.commands.registerCommand(clearTargetSelection, () =>
            handlers.targetController.clearSelectionCommandHandler(),
        ),
        vscode.commands.registerCommand(openSettings, () =>
            handlers.openSettings.openSettingsCommandHandler(),
        ),
        vscode.commands.registerCommand(initProject, () =>
            handlers.projectInit.initProjectCommandHandler(),
        ),
        vscode.commands.registerCommand(cloneProject, () =>
            handlers.projectClone.cloneCommandHandler(),
        ),
        vscode.commands.registerCommand(deploy, () =>
            handlers.deploy.deployCommandHandler(),
        ),
        vscode.commands.registerCommand(
            deployContext,
            (resource?: vscode.Uri) =>
                handlers.deploy.deployContextCommandHandler(resource),
        ),
        vscode.commands.registerCommand(deployProject, (treeNode) =>
            handlers.deploy.deployProjectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(stop, (resource?: vscode.Uri) =>
            handlers.stop.stopCommandHandler(resource),
        ),
        vscode.commands.registerCommand(stopProject, (treeNode) =>
            handlers.stop.stopProjectCommandHandler(treeNode),
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
        vscode.commands.registerCommand(fixIssue, (treeNode) =>
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
    );

    return disposables;
}
