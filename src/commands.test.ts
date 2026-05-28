import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { HostController } from './controllers/hostController';
import * as commands from './commands';
import { executeCommand } from './util/test/executeCommand';
import type { Mock } from 'vitest';
import { logger } from './util/logger';
import { TargetController } from './controllers/targetController';
import { ProjectController } from './controllers/projectController';

vi.mock('./util/logger');

describe('commands', () => {
    const hostController = mock<HostController>();
    const targetController = mock<TargetController>();
    const projectController = mock<ProjectController>();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers all exported commands', () => {
        commands.register(hostController, targetController, projectController);

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
            [commands.refreshHostHealth, hostController.refreshHealth],
            [commands.showOutput, vi.mocked(logger.show)],
            [commands.selectTarget, targetController.select],
            [commands.removeTarget, targetController.remove],
            [commands.addTarget, targetController.promptToAdd],
            [commands.inspectHostHealth, hostController.openHealthDocument],
            [commands.initProject, projectController.initProject],
            [commands.deploy, projectController.deploy],
            [commands.stop, projectController.stop],
        ];

        it.each(cases)(
            '%s calls the correct handler',
            async (command, handler) => {
                commands.register(
                    hostController,
                    targetController,
                    projectController,
                );

                await executeCommand(command, 'argument');

                expect(handler).toHaveBeenCalled();
            },
        );
    });
});
