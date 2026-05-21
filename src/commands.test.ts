import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { HostController } from './controllers/hostController';
import * as commands from './commands';
import { TargetsController } from './controllers/targetsController';

describe('commands', () => {
    const hostController = mock<HostController>();
    const targetsController = mock<TargetsController>();

    it('registers all exported commands', () => {
        commands.register(hostController, targetsController);

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
        const disposables: vscode.Disposable[] = [];
        jest.mocked(vscode.commands.registerCommand).mockImplementation(() => {
            const disposable = mock<vscode.Disposable>();
            disposables.push(disposable);
            return disposable;
        });
        const registration = commands.register(
            hostController,
            targetsController,
        );

        registration.dispose();

        for (const disposable of disposables) {
            expect(disposable.dispose).toHaveBeenCalledWith();
        }
    });
});
