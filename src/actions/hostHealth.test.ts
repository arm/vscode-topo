import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { HostHealth } from './hostHealth';
import { TopoCli } from '../topoCli';
import { HealthCheckResult } from '../topoCliSchema';

jest.mock('../util/logger');

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const addCall = calls.find((call: unknown[]) => call[0] === command);
    if (!addCall) {
        throw new Error(`No handler registered for command ${command}`);
    }
    const handler = addCall[1] as (...handlerArgs: unknown[]) => Promise<void>;
    await handler(...args);
}

describe('HostHealth', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let topoCli: MockProxy<TopoCli>;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        topoCli = mock<TopoCli>();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers host health command and content provider', () => {
        const health = new HostHealth(context, topoCli);

        health.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            HostHealth.inspectHostHealthCommand,
            expect.any(Function),
        );
        expect(
            vscode.workspace.registerTextDocumentContentProvider,
        ).toHaveBeenCalledWith(
            HostHealth.inspectHostHealthScheme,
            expect.any(Object),
        );
        expect(context.subscriptions.length).toBe(2);
    });

    it('opens a readonly host health virtual document', async () => {
        const hostHealth: HealthCheckResult['host'] = {
            dependencies: [
                {
                    name: 'Container Engine',
                    status: 'ok',
                    value: 'docker',
                },
            ],
        };
        const healthResult: HealthCheckResult = {
            host: hostHealth,
            target: {
                isLocalhost: true,
                dependencies: [],
                connectivity: {
                    name: 'Connectivity',
                    status: 'ok',
                    value: 'ok',
                },
                subsystemDriver: {
                    name: 'Subsystem Driver',
                    status: 'ok',
                    value: 'ready',
                },
            },
        };
        topoCli.health.mockResolvedValue(healthResult);
        const health = new HostHealth(context, topoCli);
        health.activate();
        const document = mock<vscode.TextDocument>();
        jest.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            document,
        );

        await executeCommand(HostHealth.inspectHostHealthCommand);

        const providerRegistration = jest.mocked(
            vscode.workspace.registerTextDocumentContentProvider,
        ).mock.calls[0];
        const contentProvider = providerRegistration[1];
        const uri = jest.mocked(vscode.workspace.openTextDocument).mock
            .calls[0][0];
        const content = await Promise.resolve(
            contentProvider.provideTextDocumentContent(
                uri as vscode.Uri,
                mock<vscode.CancellationToken>(),
            ),
        );

        expect(topoCli.health).toHaveBeenCalledWith('localhost');
        expect((uri as vscode.Uri).scheme).toBe(
            HostHealth.inspectHostHealthScheme,
        );
        expect(JSON.parse(content!)).toEqual(hostHealth);
        expect(vscode.window.showTextDocument).toHaveBeenCalledWith(document, {
            preview: true,
        });
    });

    it('shows an error when host health command fails', async () => {
        topoCli.health.mockRejectedValue(new Error('health unavailable'));
        const health = new HostHealth(context, topoCli);
        health.activate();

        await executeCommand(HostHealth.inspectHostHealthCommand);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to inspect host health. health unavailable',
        );
    });
});
