import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { HostController } from './controllers/hostController';
import * as commands from './commands';
import { executeCommand } from './util/test/executeCommand';
import type { Mock } from 'vitest';
import { logger } from './util/logger';
import { TargetController } from './controllers/targetController';
import { ProjectInit } from './actions/projectInit';
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { OpenContainerShell } from './actions/openContainerShell';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerDelete } from './actions/containerDelete';
import { FixIssue } from './actions/fixIssue';
import { ProjectClone } from './actions/projectClone';
import { ProjectTreeItem } from './views/treeItems/projectTreeItem';
import { unloaded } from './util/loadable';
import { ProjectController } from './controllers/projectController';
import { ConnectViaSSH } from './actions/connectViaSSH';
import { OpenContainerInBrowser } from './actions/openContainerInBrowser';
import { OpenSettings } from './actions/openSettings';

vi.mock('./util/logger');

describe('commands', () => {
    const handlers = {
        hostController: mock<HostController>(),
        projectController: mock<ProjectController>(),
        targetController: mock<TargetController>(),
        projectInit: mock<ProjectInit>(),
        projectClone: mock<ProjectClone>(),
        deploy: mock<Deploy>(),
        stop: mock<Stop>(),
        openContainerShell: mock<OpenContainerShell>(),
        connectViaSSH: mock<ConnectViaSSH>(),
        openContainerInBrowser: mock<OpenContainerInBrowser>(),
        containerStart: mock<ContainerStart>(),
        containerStop: mock<ContainerStop>(),
        containerDelete: mock<ContainerDelete>(),
        fixIssue: mock<FixIssue>(),
        openSettings: mock<OpenSettings>(),
    } satisfies commands.CommandHandlers;

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers all exported commands', () => {
        commands.register(handlers);

        for (const command of Object.values(commands)) {
            if (typeof command !== 'string' || !command.startsWith('topo.')) {
                continue;
            }

            expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
                command,
                expect.any(Function),
            );
        }
    });

    describe('command handlers', () => {
        const cases: [string, Mock][] = [
            [
                commands.refreshHostHealth,
                handlers.hostController.refreshHealthCommandHandler,
            ],
            [
                commands.refreshProjects,
                handlers.projectController.refreshProjects,
            ],
            [
                commands.refreshTargetData,
                handlers.targetController
                    .refreshSelectedTargetHealthCommandHandler,
            ],
            [commands.showOutput, vi.mocked(logger.show)],
            [
                commands.selectTarget,
                handlers.targetController.selectCommandHandler,
            ],
            [
                commands.resetExtensionData,
                handlers.targetController.resetExtensionDataCommandHandler,
            ],
            [
                commands.clearTargetSelection,
                handlers.targetController.clearSelectionCommandHandler,
            ],
            [
                commands.openSettings,
                handlers.openSettings.openSettingsCommandHandler,
            ],
            [
                commands.initProject,
                handlers.projectInit.initProjectCommandHandler,
            ],
            [commands.cloneProject, handlers.projectClone.cloneCommandHandler],
            [commands.deploy, handlers.deploy.deployCommandHandler],
            [
                commands.deployContext,
                handlers.deploy.deployContextCommandHandler,
            ],
            [
                commands.deployProject,
                handlers.deploy.deployProjectCommandHandler,
            ],
            [commands.stop, handlers.stop.stopCommandHandler],
            [commands.stopProject, handlers.stop.stopProjectCommandHandler],
            [
                commands.openContainerShell,
                handlers.openContainerShell.openContainerShellCommandHandler,
            ],
            [
                commands.connectViaSSH,
                handlers.connectViaSSH.connectViaSSHCommandHandler,
            ],
            [
                commands.openContainerInBrowser,
                handlers.openContainerInBrowser
                    .openContainerInBrowserCommandHandler,
            ],
            [
                commands.startContainer,
                handlers.containerStart.startContainerCommandHandler,
            ],
            [
                commands.stopContainer,
                handlers.containerStop.stopContainerCommandHandler,
            ],
            [
                commands.deleteContainer,
                handlers.containerDelete.deleteContainerCommandHandler,
            ],

            [commands.fixIssue, handlers.fixIssue.fixIssueCommandHandler],
            [
                commands.fixTargetIssues,
                handlers.fixIssue.fixIssueCommandHandler,
            ],
            [
                commands.remoteClone,
                handlers.projectClone.remoteCloneCommandHandler,
            ],
            [
                commands.localClone,
                handlers.projectClone.localCloneCommandHandler,
            ],
            [
                commands.templateClone,
                handlers.projectClone.templateCloneCommandHandler,
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

            await executeCommand(commands.selectTarget, 'argument');

            expect(
                handlers.targetController.selectCommandHandler,
            ).toHaveBeenCalledWith();
        });

        it('connects via SSH without a tree node argument', async () => {
            commands.register(handlers);

            await executeCommand(commands.connectViaSSH, 'argument');

            expect(
                handlers.connectViaSSH.connectViaSSHCommandHandler,
            ).toHaveBeenCalledWith();
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

            await executeCommand(commands.deployProject, projectItem);

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

            await executeCommand(commands.stopProject, projectItem);

            expect(
                handlers.stop.stopProjectCommandHandler,
            ).toHaveBeenCalledWith(projectItem);
        });
    });
});
