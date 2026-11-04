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
import { OpenContainerLogs } from './actions/openContainerLogs';
import { OpenProjectLogs } from './actions/openProjectLogs';
import { ContainerLifecycle } from './actions/containerLifecycle';
import { FixIssue } from './actions/fixIssue';
import { ProjectClone } from './actions/projectClone';
import { createProjectTreeItem } from './util/test/projectTreeItem';
import { ProjectController } from './controllers/projectController';
import { ConnectViaSSH } from './actions/connectViaSSH';
import { OpenContainerInBrowser } from './actions/openContainerInBrowser';
import { OpenSettings } from './actions/openSettings';
import { Configure } from './actions/configure';
import { SkillLifecycle } from './actions/skillLifecycle';

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
        openContainerLogs: mock<OpenContainerLogs>(),
        openProjectLogs: mock<OpenProjectLogs>(),
        connectViaSSH: mock<ConnectViaSSH>(),
        openContainerInBrowser: mock<OpenContainerInBrowser>(),
        containerLifecycle: mock<ContainerLifecycle>(),
        fixIssue: mock<FixIssue>(),
        openSettings: mock<OpenSettings>(),
        skillLifecycle: mock<SkillLifecycle>(),
    } satisfies commands.CommandHandlers;

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
                commandIds.openContainerEngineSettings,
                handlers.openSettings.openContainerEngineSettingsCommandHandler,
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
                commandIds.openContainerLogs,
                handlers.openContainerLogs.openContainerLogsCommandHandler,
            ],
            [
                commandIds.openProjectLogs,
                handlers.openProjectLogs.openProjectLogsCommandHandler,
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
                handlers.skillLifecycle.installSkillCommandHandler,
            ],
            [
                commandIds.uninstallSkill,
                handlers.skillLifecycle.uninstallSkillCommandHandler,
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

        it.each([
            [
                commandIds.configureProject,
                handlers.configure.configureProjectCommandHandler,
            ],
            [
                commandIds.deployProject,
                handlers.deploy.deployProjectCommandHandler,
            ],
            [commandIds.stopProject, handlers.stop.stopProjectCommandHandler],
            [
                commandIds.openProjectLogs,
                handlers.openProjectLogs.openProjectLogsCommandHandler,
            ],
        ])(
            '%s passes the project tree node to its handler',
            async (command, handler) => {
                const projectItem = createProjectTreeItem(
                    vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
                );
                commands.register(handlers);

                await executeCommand(command, projectItem);

                expect(handler).toHaveBeenCalledWith(projectItem);
            },
        );
    });
});
