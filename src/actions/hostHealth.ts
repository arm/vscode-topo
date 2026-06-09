import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TopoCli } from '../topoCli';
import { DisposableCollector } from '../util/disposableCollector';
import { showAndLogError } from '../util/showAndLogError';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';
import { HostHealthCheck } from '../topoCliSchema';

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
                () => this.inspectHealthCommandHandler(),
            ),
        );
    }

    public async inspectHealthCommandHandler(): Promise<void> {
        let health: HostHealthCheck;
        try {
            health = await this.topoCli.hostHealth();
        } catch (err) {
            return showAndLogError('Failed to inspect host health', err);
        }

        const fileName = `${manifest.PACKAGE_NAME}-host-health-${Date.now()}.json`;
        const documentUri = this.healthDocumentProvider.createUri(fileName);
        const content = JSON.stringify(health.host, null, 4);
        await this.healthDocumentProvider.open(documentUri, content);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
