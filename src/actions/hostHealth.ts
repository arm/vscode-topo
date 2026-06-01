import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TopoCli } from '../topoCli';
import { DisposableCollector } from '../util/disposableCollector';
import { showAndLogError } from '../util/showAndLogError';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';

export class HostHealth implements vscode.Disposable {
    public static readonly inspectHostHealthCommand = `${manifest.PACKAGE_NAME}.inspectHostHealth`;

    private readonly disposables = new DisposableCollector();

    constructor(
        private readonly topoCli: TopoCli,
        private readonly healthDocumentProvider: TransientDocumentProvider,
    ) {}

    public activate(): void {
        this.disposables.collect(
            vscode.commands.registerCommand(
                HostHealth.inspectHostHealthCommand,
                () => this.inspectHealth(),
            ),
        );
    }

    private async inspectHealth(): Promise<void> {
        const fileName = `${manifest.PACKAGE_NAME}-host-health-${Date.now()}.json`;
        const documentUri = this.healthDocumentProvider.createUri(fileName);

        try {
            const health = await this.topoCli.hostHealth();
            const content = JSON.stringify(health.host, null, 4);
            await this.healthDocumentProvider.open(documentUri, content);
        } catch (err) {
            showAndLogError('Failed to inspect host health', err);
        }
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
