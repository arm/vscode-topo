import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TopoCli } from '../topoCli';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { HealthCheckResult } from '../topoCliSchema';

const hostHealthTarget = 'localhost';
const inspectHostHealthAction: vscode.MessageItem = {
    title: 'Inspect Host Health',
};

export class HostHealth {
    public static readonly inspectHostHealthCommand = `${PACKAGE_NAME}.inspectHostHealth`;
    public static readonly inspectHostHealthScheme = `${PACKAGE_NAME}-inspect-host-health`;

    private readonly inspectHealthDocuments = new Map<string, string>();
    private readonly inspectHealthContentProvider: vscode.TextDocumentContentProvider =
        {
            provideTextDocumentContent: (uri: vscode.Uri): string => {
                return (
                    this.inspectHealthDocuments.get(uri.toString()) ?? 'null'
                );
            },
        };

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly topoCli: TopoCli,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                HostHealth.inspectHostHealthCommand,
                this.inspectHostHealth.bind(this),
            ),
            vscode.workspace.registerTextDocumentContentProvider(
                HostHealth.inspectHostHealthScheme,
                this.inspectHealthContentProvider,
            ),
        );
    }

    public async checkHostDependencyHealth(): Promise<void> {
        let health: HealthCheckResult;
        try {
            health = await this.topoCli.health(hostHealthTarget);
        } catch (err) {
            logger.warn('Failed to verify host dependencies on startup', err);
            return;
        }

        const unhealthyDependencies = health.host.dependencies
            .filter((v) => !v.healthy)
            .map((dependency) => dependency.name);
        if (unhealthyDependencies.length === 0) {
            return;
        }

        const choice = await vscode.window.showWarningMessage(
            `Missing or unhealthy host dependencies: ${unhealthyDependencies.join(', ')}. Some Topo features may not work.`,
            inspectHostHealthAction,
        );
        if (choice?.title === inspectHostHealthAction.title) {
            await vscode.commands.executeCommand(
                HostHealth.inspectHostHealthCommand,
            );
        }
    }

    private async inspectHostHealth(): Promise<void> {
        let health: HealthCheckResult;
        try {
            health = await this.topoCli.health(hostHealthTarget);
        } catch (err) {
            showAndLogError('Failed to inspect host health', err);
            return;
        }

        const content = JSON.stringify(health?.host ?? null, null, 4);
        const documentUri = vscode.Uri.from({
            scheme: HostHealth.inspectHostHealthScheme,
            path: `/host-health-${Date.now()}.json`,
        });

        this.inspectHealthDocuments.clear();
        this.inspectHealthDocuments.set(documentUri.toString(), content);

        const document = await vscode.workspace.openTextDocument(documentUri);
        await vscode.window.showTextDocument(document, { preview: true });
    }
}
