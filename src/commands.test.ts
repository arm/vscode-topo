import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { HostController } from './controllers/hostController';
import * as commands from './commands';
import { executeCommand } from './util/test/executeCommand';

describe('commands', () => {
    it('registers all exported commands', () => {
        const hostController = mock<HostController>();

        commands.register(hostController);

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
        const registration = commands.register(hostController);

        registration.dispose();

        for (const disposable of disposables) {
            expect(disposable.dispose).toHaveBeenCalledWith();
        }
    });

    describe('command handlers', () => {
        const hostController = mock<HostController>();
        const cases: [string, jest.Mock][] = [
            [commands.refreshHostHealth, hostController.refreshHealth],
        ];

        it.each(cases)(
            '%s calls the correct handler',
            async (command, handler) => {
                commands.register(hostController);

                await executeCommand(command);

                expect(handler).toHaveBeenCalled();
            },
        );
    });
});
