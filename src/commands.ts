import type { HostController } from './controllers/hostController';
import type { TargetController } from './controllers/targetController';
import * as vscode from 'vscode';
import { logger } from './util/logger';
import { DisposableCollector } from './util/disposableCollector';
import type { Deploy } from './actions/deploy';
import type { Stop } from './actions/stop';
import type { OpenContainerShell } from './actions/openContainerShell';
import type { ContainerLifecycle } from './actions/containerLifecycle';
import type { FixIssue } from './actions/fixIssue';
import type { ProjectClone } from './actions/projectClone';
import type { ProjectController } from './controllers/projectController';
import type { ConnectViaSSH } from './actions/connectViaSSH';
import type { OpenContainerInBrowser } from './actions/openContainerInBrowser';
import type { OpenSettings } from './actions/openSettings';
import type { Configure } from './actions/configure';
import type { SkillLifecycle } from './actions/skillLifecycle';
import * as commandIds from './commandIds';

export interface CommandHandlers {
    hostController: HostController;
    projectController: ProjectController;
    targetController: TargetController;
    projectClone: ProjectClone;
    configure: Configure;
    deploy: Deploy;
    stop: Stop;
    openContainerShell: OpenContainerShell;
    connectViaSSH: ConnectViaSSH;
    openContainerInBrowser: OpenContainerInBrowser;
    containerLifecycle: ContainerLifecycle;
    fixIssue: FixIssue;
    openSettings: OpenSettings;
    skillLifecycle: SkillLifecycle;
}

export function register(handlers: CommandHandlers): vscode.Disposable {
    const disposables = new DisposableCollector();
    disposables.collect(
        vscode.commands.registerCommand(commandIds.refreshHost, () =>
            handlers.hostController.refreshHostCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.refreshProjects, () =>
            handlers.projectController.refreshProjects(),
        ),
        vscode.commands.registerCommand(commandIds.refreshTargetData, () =>
            handlers.targetController.refreshSelectedTargetDataCommandHandler(),
        ),
        vscode.commands.registerCommand(
            commandIds.refreshProjectContainers,
            () =>
                handlers.projectController.refreshProjectContainersCommandHandler(),
        ),
        vscode.commands.registerCommand(
            commandIds.refreshSelectedTargetHealth,
            () =>
                handlers.targetController.refreshSelectedTargetHealthCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.refreshSkillStatus, () =>
            handlers.hostController.refreshSkillStatus(),
        ),
        vscode.commands.registerCommand(commandIds.showOutput, () =>
            logger.show(),
        ),
        vscode.commands.registerCommand(commandIds.selectTarget, () =>
            handlers.targetController.selectCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.resetExtensionData, () =>
            handlers.targetController.resetExtensionDataCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.clearTargetSelection, () =>
            handlers.targetController.clearSelectionCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.openSettings, () =>
            handlers.openSettings.openSettingsCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.cloneProject, () =>
            handlers.projectClone.cloneCommandHandler(),
        ),
        vscode.commands.registerCommand(
            commandIds.configure,
            (resource?: vscode.Uri) =>
                handlers.configure.configureContextCommandHandler(resource),
        ),
        vscode.commands.registerCommand(
            commandIds.configureProject,
            (treeNode) =>
                handlers.configure.configureProjectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(commandIds.deploy, () =>
            handlers.deploy.deployCommandHandler(),
        ),
        vscode.commands.registerCommand(
            commandIds.deployContext,
            (resource?: vscode.Uri) =>
                handlers.deploy.deployContextCommandHandler(resource),
        ),
        vscode.commands.registerCommand(commandIds.deployProject, (treeNode) =>
            handlers.deploy.deployProjectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(
            commandIds.stop,
            (resource?: vscode.Uri) =>
                handlers.stop.stopCommandHandler(resource),
        ),
        vscode.commands.registerCommand(commandIds.stopProject, (treeNode) =>
            handlers.stop.stopProjectCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(
            commandIds.openContainerShell,
            (treeNode) =>
                handlers.openContainerShell.openContainerShellCommandHandler(
                    treeNode,
                ),
        ),
        vscode.commands.registerCommand(commandIds.connectViaSSH, () =>
            handlers.connectViaSSH.connectViaSSHCommandHandler(),
        ),
        vscode.commands.registerCommand(
            commandIds.openContainerInBrowser,
            (treeNode) =>
                handlers.openContainerInBrowser.openContainerInBrowserCommandHandler(
                    treeNode,
                ),
        ),
        vscode.commands.registerCommand(commandIds.startContainer, (treeNode) =>
            handlers.containerLifecycle.startContainerCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(commandIds.stopContainer, (treeNode) =>
            handlers.containerLifecycle.stopContainerCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(
            commandIds.deleteContainer,
            (treeNode) =>
                handlers.containerLifecycle.deleteContainerCommandHandler(
                    treeNode,
                ),
        ),
        vscode.commands.registerCommand(commandIds.fixIssue, (treeNode) =>
            handlers.fixIssue.fixIssueCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(
            commandIds.fixTargetIssues,
            (treeNode) => handlers.fixIssue.fixIssueCommandHandler(treeNode),
        ),
        vscode.commands.registerCommand(commandIds.remoteClone, () =>
            handlers.projectClone.remoteCloneCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.localClone, () =>
            handlers.projectClone.localCloneCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.installSkill, () =>
            handlers.skillLifecycle.installSkillCommandHandler(),
        ),
        vscode.commands.registerCommand(commandIds.uninstallSkill, () =>
            handlers.skillLifecycle.uninstallSkillCommandHandler(),
        ),
    );

    return disposables;
}
