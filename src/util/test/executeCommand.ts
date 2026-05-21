import * as vscode from 'vscode';

type RegisteredCommandHandler = (...args: unknown[]) => unknown;

export async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const matching = calls.filter((call) => call[0] === command);
    if (!matching.length) {
        throw new Error(`No handler registered for command ${command}`);
    }

    const addCall = matching[matching.length - 1];
    const handler = addCall[1] as RegisteredCommandHandler;
    await Promise.resolve(handler(...args));
}
