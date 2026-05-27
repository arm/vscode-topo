import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { HostController } from './controllers/hostController';
import * as commands from './commands';
import { executeCommand } from './util/test/executeCommand';
import { TargetController } from './controllers/targetController';

jest.mock('./util/logger');

describe('commands', () => {
    const hostController = mock<HostController>();
    const targetController = mock<TargetController>();

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers all exported commands', () => {
        commands.register(hostController, targetController);

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

    it('disposes all registered commands', () => {
        const hostController = mock<HostController>();
        const disposables: vscode.Disposable[] = [];
        jest.mocked(vscode.commands.registerCommand).mockImplementation(() => {
            const disposable = mock<vscode.Disposable>();
            disposables.push(disposable);
            return disposable;
        });
        const registration = commands.register(
            hostController,
            targetController,
        );

        registration.dispose();

        for (const disposable of disposables) {
            expect(disposable.dispose).toHaveBeenCalledWith();
        }
    });

    describe('command handlers', () => {
        const cases: [string, jest.Mock][] = [
            [commands.refreshHostHealth, hostController.refreshHealth],
        ];

        it.each(cases)(
            '%s calls the correct handler',
            async (command, handler) => {
                commands.register(hostController, targetController);

                await executeCommand(command);

                expect(handler).toHaveBeenCalled();
            },
        );
    });
});
