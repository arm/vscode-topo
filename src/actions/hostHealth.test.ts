import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { HostHealth } from './hostHealth';
import { TopoCli } from '../topoCli';
import { HealthCheckResult, HostHealthCheckResult } from '../topoCliSchema';
import { executeCommand } from '../util/test/executeCommand';

vi.mock('../util/logger');

describe('HostHealth', () => {
    let context: MockProxy<vscode.ExtensionContext>;
    let topoCli: MockProxy<TopoCli>;

    beforeEach(() => {
        context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        topoCli = mock<TopoCli>();
    });

    afterEach(() => {
        vi.clearAllMocks();
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
        const healthResult: HostHealthCheckResult = {
            host: hostHealth,
        };
        topoCli.hostHealth.mockResolvedValue(healthResult);
        const health = new HostHealth(context, topoCli);
        health.activate();
        const document = mock<vscode.TextDocument>();
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            document,
        );

        await executeCommand(HostHealth.inspectHostHealthCommand);

        const providerRegistration = vi.mocked(
            vscode.workspace.registerTextDocumentContentProvider,
        ).mock.calls[0];
        const contentProvider = providerRegistration[1];
        const uri = vi.mocked(vscode.workspace.openTextDocument).mock
            .calls[0][0];
        const content = await Promise.resolve(
            contentProvider.provideTextDocumentContent(
                uri as vscode.Uri,
                mock<vscode.CancellationToken>(),
            ),
        );

        expect(topoCli.hostHealth).toHaveBeenCalledWith();
        expect((uri as vscode.Uri).scheme).toBe(
            HostHealth.inspectHostHealthScheme,
        );
        expect(JSON.parse(content!)).toEqual(hostHealth);
        expect(vscode.window.showTextDocument).toHaveBeenCalledWith(document, {
            preview: true,
        });
    });

    it('shows an error when host health command fails', async () => {
        topoCli.hostHealth.mockRejectedValue(new Error('health unavailable'));
        const health = new HostHealth(context, topoCli);
        health.activate();

        await executeCommand(HostHealth.inspectHostHealthCommand);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to inspect host health. health unavailable',
        );
    });
});
