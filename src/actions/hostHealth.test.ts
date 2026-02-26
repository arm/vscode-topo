import * as vscode from 'vscode';
import { mock, MockProxy } from 'jest-mock-extended';
import { HostHealth } from './hostHealth';
import { TopoCli } from '../topoCli';
import { HealthCheckResult } from '../util/types';

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
        const hostHealth = {
            Dependencies: [
                {
                    Name: 'Container Engine',
                    Healthy: true,
                    Value: 'docker',
                },
            ],
        };
        const healthResult: HealthCheckResult = {
            Host: hostHealth,
            Target: {
                IsLocalHost: true,
                Dependencies: [],
                Connectivity: {
                    Name: 'Connectivity',
                    Healthy: true,
                    Value: 'ok',
                },
                SubsystemDriver: {
                    Name: 'Subsystem Driver',
                    Healthy: true,
                    Value: 'ready',
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

    it('shows warning when startup host dependencies are unhealthy', async () => {
        topoCli.health.mockResolvedValue(
            mock<HealthCheckResult>({
                Host: {
                    Dependencies: [
                        {
                            Name: 'SSH',
                            Healthy: false,
                            Value: 'missing',
                        },
                    ],
                },
            }),
        );
        const inspectHostHealthAction: vscode.MessageItem = {
            title: 'Inspect Host Health',
        };
        jest.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
            inspectHostHealthAction,
        );
        const health = new HostHealth(context, topoCli);

        await health.checkHostDependencyHealth();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('SSH'),
            inspectHostHealthAction,
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            HostHealth.inspectHostHealthCommand,
        );
    });

    it('does not warn when startup blocking host dependencies are healthy', async () => {
        topoCli.health.mockResolvedValue(
            mock<HealthCheckResult>({
                Host: {
                    Dependencies: [
                        {
                            Name: 'SSH',
                            Healthy: true,
                            Value: 'ok',
                        },
                    ],
                },
            }),
        );
        const health = new HostHealth(context, topoCli);

        await health.checkHostDependencyHealth();

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('does not warn when startup host health check fails', async () => {
        topoCli.health.mockRejectedValue(new Error('health unavailable'));
        const health = new HostHealth(context, topoCli);

        await health.checkHostDependencyHealth();

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });
});
