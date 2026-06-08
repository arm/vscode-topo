import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';
import { PACKAGE_NAME } from './manifest';
import * as vscode from 'vscode';
import { logger } from './util/logger';
import { DisposableCollector } from './util/disposableCollector';
import { ProjectInit } from './actions/projectInit';
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVsCode } from './actions/attachVsCode';
import { AttachShell } from './actions/attachShell';
import { SetupKeys } from './actions/setupKeys';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerDelete } from './actions/containerDelete';
import { TargetHealth } from './actions/targetHealth';
import { FixIssue } from './actions/fixIssue';
import { HostHealth } from './actions/hostHealth';
import { ProjectClone } from './actions/projectClone';

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
export const openInBrowser = command('openInBrowser');
export const attachVsCode = command('attachVsCode');
export const attachShell = command('attachShell');
export const setupKeys = command('setupKeys');
export const startContainer = command('startContainer');
export const stopContainer = command('stopContainer');
export const deleteContainer = command('deleteContainer');
export const inspectTargetHealth = command('inspectTargetHealth');
export const fixDependencyIssue = command('fixDependencyIssue');
export const fixTargetIssues = command('fixTargetIssues');
export const remoteClone = command('remoteClone');
export const localClone = command('localClone');
export const templateClone = command('templateClone');

export interface CommandHandlers {
    hostController: HostController;
    hostHealth: HostHealth;
    targetController: TargetController;
    projectInit: ProjectInit;
    projectClone: ProjectClone;
    deploy: Deploy;
    stop: Stop;
    containerOpenInBrowser: ContainerOpenInBrowser;
    attachVsCode: AttachVsCode;
    attachShell: AttachShell;
    setupKeys: SetupKeys;
    containerStart: ContainerStart;
    containerStop: ContainerStop;
    containerDelete: ContainerDelete;
    targetHealth: TargetHealth;
    fixIssue: FixIssue;
}

export function register(handlers: CommandHandlers): vscode.Disposable {
    const disposables = new DisposableCollector();
    disposables.collect(
        vscode.commands.registerCommand(refreshHostHealth, () =>
            handlers.hostController.refreshHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(showOutput, () => logger.show()),
        vscode.commands.registerCommand(selectTarget, (treeNode) =>
            handlers.targetController.selectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(removeTarget, (treeNode) =>
            handlers.targetController.removeCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(addTarget, () =>
            handlers.targetController.addCommandHandler(),
        ),
        vscode.commands.registerCommand(inspectHostHealth, () =>
            handlers.hostHealth.inspectHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(initProject, () =>
            handlers.projectInit.initProjectCommandHandler(),
        ),
        vscode.commands.registerCommand(deploy, (resource?: vscode.Uri) =>
            handlers.deploy.deployCommandHandler(resource),
        ),
        vscode.commands.registerCommand(stop, (resource?: vscode.Uri) =>
            handlers.stop.stopCommandHandler(resource),
        ),
        vscode.commands.registerCommand(openInBrowser, (treeNode) =>
            handlers.containerOpenInBrowser.openInBrowserCommandHandler(
                treeNode,
            ),
        ),
        vscode.commands.registerCommand(attachVsCode, (treeNode) =>
            handlers.attachVsCode.attachVsCodeCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(attachShell, (treeNode) =>
            handlers.attachShell.attachShellCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(setupKeys, (treeNode) =>
            handlers.setupKeys.setupKeysCommandHandler(treeNode),
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
        vscode.commands.registerCommand(inspectTargetHealth, (treeNode) =>
            handlers.targetHealth.inspectHealthCommandHandler(treeNode),
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
