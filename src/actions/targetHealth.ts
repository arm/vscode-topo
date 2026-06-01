import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { logger } from '../util/logger';
import { DisposableCollector } from '../util/disposableCollector';
import { TopoCli } from '../topoCli';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';
import { showAndLogError } from '../util/showAndLogError';

export class TargetHealth implements vscode.Disposable {
    public static readonly inspectTargetHealthCommand = `${manifest.PACKAGE_NAME}.inspectTargetHealth`;

    private readonly disposables = new DisposableCollector();

    constructor(
        private readonly topoCli: TopoCli,
        private readonly healthDocumentProvider: TransientDocumentProvider,
    ) {}

    public activate(): void {
        this.disposables.collect(
            vscode.commands.registerCommand(
                TargetHealth.inspectTargetHealthCommand,
                (node: unknown) => this.inspectHealth(node),
            ),
        );
    }

    private async inspectHealth(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeItem)) {
            const errMsg = `Invalid target type for inspect health: expected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        if (!treeNode.selected) {
            const errMsg = `Invalid target for inspect health: expected selected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        const safeTargetSsh = treeNode.target.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${manifest.PACKAGE_NAME}-${safeTargetSsh}-health-${Date.now()}.json`;

        try {
            const health = await this.topoCli.health(treeNode.target);
            const content = JSON.stringify(health.target, null, 4);
            const documentUri = this.healthDocumentProvider.createUri(fileName);
            await this.healthDocumentProvider.open(documentUri, content);
        } catch (err) {
            return showAndLogError('Failed to get health for target', err);
        }
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
