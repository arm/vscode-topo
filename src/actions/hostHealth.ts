import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TopoCli } from '../topoCli';
import { showAndLogError } from '../util/showAndLogError';
import { HealthCheckResult } from '../topoCliSchema';

const hostHealthTarget = 'localhost';

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
                this.handleInspectHostHealthCommand.bind(this),
            ),
            vscode.workspace.registerTextDocumentContentProvider(
                HostHealth.inspectHostHealthScheme,
                this.inspectHealthContentProvider,
            ),
        );
    }

    private async handleInspectHostHealthCommand(): Promise<void> {
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
