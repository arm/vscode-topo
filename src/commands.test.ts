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
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVsCode } from './actions/attachVsCode';
import { AttachShell } from './actions/attachShell';
import { SetupKeys } from './actions/setupKeys';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerDelete } from './actions/containerDelete';
import { TargetHealth } from './actions/targetHealth';
import { FixIssue } from './actions/fixIssue';

vi.mock('./util/logger');

describe('commands', () => {
    const handlers = {
        hostController: mock<HostController>(),
        targetController: mock<TargetController>(),
        projectInit: mock<ProjectInit>(),
        deploy: mock<Deploy>(),
        stop: mock<Stop>(),
        containerOpenInBrowser: mock<ContainerOpenInBrowser>(),
        attachVsCode: mock<AttachVsCode>(),
        attachShell: mock<AttachShell>(),
        setupKeys: mock<SetupKeys>(),
        containerStart: mock<ContainerStart>(),
        containerStop: mock<ContainerStop>(),
        containerDelete: mock<ContainerDelete>(),
        targetHealth: mock<TargetHealth>(),
        fixIssue: mock<FixIssue>(),
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
            [commands.refreshHostHealth, handlers.hostController.refreshHealthCommandHandler],
            [commands.showOutput, vi.mocked(logger.show)],
            [commands.selectTarget, handlers.targetController.selectCommandHandler],
            [commands.removeTarget, handlers.targetController.removeCommandHandler],
            [commands.addTarget, handlers.targetController.addCommandHandler],
            [
                commands.inspectHostHealth,
                handlers.hostController.inspectHealthCommandHandler,
            ],
            [
                commands.initProject,
                handlers.projectInit.initProjectCommandHandler,
            ],
            [commands.deploy, handlers.deploy.deployCommandHandler],
            [commands.stop, handlers.stop.stopCommandHandler],
            [
                commands.openInBrowser,
                handlers.containerOpenInBrowser.openInBrowserCommandHandler,
            ],
            [
                commands.attachVsCode,
                handlers.attachVsCode.attachVsCodeCommandHandler,
            ],
            [
                commands.attachShell,
                handlers.attachShell.attachShellCommandHandler,
            ],
            [commands.setupKeys, handlers.setupKeys.setupKeysCommandHandler],
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
            [
                commands.inspectTargetHealth,
                handlers.targetHealth.inspectHealthCommandHandler,
            ],
            [commands.fixIssue, handlers.fixIssue.fixIssueCommandHandler],
        ];

        it.each(cases)(
            '%s calls the correct handler',
            async (command, handler) => {
                commands.register(handlers);

                await executeCommand(command, 'argument');

                expect(handler).toHaveBeenCalled();
            },
        );
    });
});
