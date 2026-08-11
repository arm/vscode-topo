import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { HostController } from './controllers/hostController';
import * as commands from './commands';
import * as commandIds from './commandIds';
import { executeCommand } from './util/test/executeCommand';
import type { Mock } from 'vitest';
import { logger } from './util/logger';
import { TargetController } from './controllers/targetController';
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { OpenContainerShell } from './actions/openContainerShell';
import { ContainerLifecycle } from './actions/containerLifecycle';
import { FixIssue } from './actions/fixIssue';
import { ProjectClone } from './actions/projectClone';
import { ProjectTreeItem } from './views/treeItems/projectTreeItem';
import { unloaded } from './util/loadable';
import { ProjectController } from './controllers/projectController';
import { ConnectViaSSH } from './actions/connectViaSSH';
import { OpenContainerInBrowser } from './actions/openContainerInBrowser';
import { OpenSettings } from './actions/openSettings';
import { Configure } from './actions/configure';
import { InstallSkill } from './actions/installSkill';

vi.mock('./util/logger');

describe('commands', () => {
    const handlers = {
        hostController: mock<HostController>(),
        projectController: mock<ProjectController>(),
        targetController: mock<TargetController>(),
        projectClone: mock<ProjectClone>(),
        configure: mock<Configure>(),
        deploy: mock<Deploy>(),
        stop: mock<Stop>(),
        openContainerShell: mock<OpenContainerShell>(),
        connectViaSSH: mock<ConnectViaSSH>(),
        openContainerInBrowser: mock<OpenContainerInBrowser>(),
        containerLifecycle: mock<ContainerLifecycle>(),
        fixIssue: mock<FixIssue>(),
        openSettings: mock<OpenSettings>(),
        installSkill: mock<InstallSkill>(),
    } satisfies commands.CommandHandlers;

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers all command IDs', () => {
        commands.register(handlers);

        for (const command of Object.values(commandIds)) {
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                command,
                expect.any(Function),
            );
        }
    });

    describe('command handlers', () => {
        const cases: [string, Mock][] = [
            [
                commandIds.refreshHost,
                handlers.hostController.refreshHostCommandHandler,
            ],
            [
                commandIds.refreshProjects,
                handlers.projectController.refreshProjects,
            ],
            [
                commandIds.refreshTargetData,
                handlers.targetController
                    .refreshSelectedTargetDataCommandHandler,
            ],
            [
                commandIds.refreshProjectContainers,
                handlers.projectController
                    .refreshProjectContainersCommandHandler,
            ],
            [
                commandIds.refreshSelectedTargetHealth,
                handlers.targetController
                    .refreshSelectedTargetHealthCommandHandler,
            ],
            [
                commandIds.refreshSkillStatus,
                handlers.hostController.refreshSkillStatus,
            ],
            [commandIds.showOutput, vi.mocked(logger.show)],
            [
                commandIds.selectTarget,
                handlers.targetController.selectCommandHandler,
            ],
            [
                commandIds.resetExtensionData,
                handlers.targetController.resetExtensionDataCommandHandler,
            ],
            [
                commandIds.clearTargetSelection,
                handlers.targetController.clearSelectionCommandHandler,
            ],
            [
                commandIds.openSettings,
                handlers.openSettings.openSettingsCommandHandler,
            ],
            [
                commandIds.cloneProject,
                handlers.projectClone.cloneCommandHandler,
            ],
            [
                commandIds.configure,
                handlers.configure.configureContextCommandHandler,
            ],
            [
                commandIds.configureProject,
                handlers.configure.configureProjectCommandHandler,
            ],
            [commandIds.deploy, handlers.deploy.deployCommandHandler],
            [
                commandIds.deployContext,
                handlers.deploy.deployContextCommandHandler,
            ],
            [
                commandIds.deployProject,
                handlers.deploy.deployProjectCommandHandler,
            ],
            [commandIds.stop, handlers.stop.stopCommandHandler],
            [commandIds.stopProject, handlers.stop.stopProjectCommandHandler],
            [
                commandIds.openContainerShell,
                handlers.openContainerShell.openContainerShellCommandHandler,
            ],
            [
                commandIds.connectViaSSH,
                handlers.connectViaSSH.connectViaSSHCommandHandler,
            ],
            [
                commandIds.openContainerInBrowser,
                handlers.openContainerInBrowser
                    .openContainerInBrowserCommandHandler,
            ],
            [
                commandIds.startContainer,
                handlers.containerLifecycle.startContainerCommandHandler,
            ],
            [
                commandIds.stopContainer,
                handlers.containerLifecycle.stopContainerCommandHandler,
            ],
            [
                commandIds.deleteContainer,
                handlers.containerLifecycle.deleteContainerCommandHandler,
            ],

            [commandIds.fixIssue, handlers.fixIssue.fixIssueCommandHandler],
            [
                commandIds.fixTargetIssues,
                handlers.fixIssue.fixIssueCommandHandler,
            ],
            [
                commandIds.remoteClone,
                handlers.projectClone.remoteCloneCommandHandler,
            ],
            [
                commandIds.localClone,
                handlers.projectClone.localCloneCommandHandler,
            ],
            [
                commandIds.installSkill,
                handlers.installSkill.installSkillCommandHandler,
            ],
        ];

        it.each(cases)(
            '%s calls the correct handler',
            async (command, handler) => {
                commands.register(handlers);

                await executeCommand(command, 'argument');

                expect(handler).toHaveBeenCalled();
            },
        );

        it('calls select target without a tree node argument', async () => {
            commands.register(handlers);

            await executeCommand(commandIds.selectTarget, 'argument');

            expect(
                handlers.targetController.selectCommandHandler,
            ).toHaveBeenCalledWith();
        });

        it('connects via SSH without a tree node argument', async () => {
            commands.register(handlers);

            await executeCommand(commandIds.connectViaSSH, 'argument');

            expect(
                handlers.connectViaSSH.connectViaSSHCommandHandler,
            ).toHaveBeenCalledWith();
        });

        it('configure project calls the project configure handler with the tree node', async () => {
            const composeFileUri = vscode.Uri.file(
                '/fake/workspace/demo/compose.yaml',
            );
            const projectItem = new ProjectTreeItem(
                {
                    name: 'demo',
                    uri: vscode.Uri.file('/fake/workspace/demo'),
                    composeFileUri,
                    workspaceIndex: 0,
                    workspaceName: 'workspace',
                },
                false,
                unloaded(),
            );
            commands.register(handlers);

            await executeCommand(commandIds.configureProject, projectItem);

            expect(
                handlers.configure.configureProjectCommandHandler,
            ).toHaveBeenCalledWith(projectItem);
        });

        it('deploy project calls the project deploy handler with the tree node', async () => {
            const composeFileUri = vscode.Uri.file(
                '/fake/workspace/demo/compose.yaml',
            );
            const projectItem = new ProjectTreeItem(
                {
                    name: 'demo',
                    uri: vscode.Uri.file('/fake/workspace/demo'),
                    composeFileUri,
                    workspaceIndex: 0,
                    workspaceName: 'workspace',
                },
                false,
                unloaded(),
            );
            commands.register(handlers);

            await executeCommand(commandIds.deployProject, projectItem);

            expect(
                handlers.deploy.deployProjectCommandHandler,
            ).toHaveBeenCalledWith(projectItem);
        });

        it('stop project calls the project stop handler with the tree node', async () => {
            const composeFileUri = vscode.Uri.file(
                '/fake/workspace/demo/compose.yaml',
            );
            const projectItem = new ProjectTreeItem(
                {
                    name: 'demo',
                    uri: vscode.Uri.file('/fake/workspace/demo'),
                    composeFileUri,
                    workspaceIndex: 0,
                    workspaceName: 'workspace',
                },
                false,
                unloaded(),
            );
            commands.register(handlers);

            await executeCommand(commandIds.stopProject, projectItem);

            expect(
                handlers.stop.stopProjectCommandHandler,
            ).toHaveBeenCalledWith(projectItem);
        });
    });
});
