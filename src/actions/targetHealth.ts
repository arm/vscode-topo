import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { logger } from '../util/logger';
import { ContainersManager } from '../target/containersManager';
import { DisposableCollector } from '../util/disposableCollector';

export class TargetHealth implements vscode.Disposable {
    public static readonly inspectTargetHealthScheme = `${manifest.PACKAGE_NAME}-inspect-target-health`;

    private readonly disposables = new DisposableCollector();
    private readonly inspectHealthDocuments = new Map<string, string>();
    private readonly inspectHealthContentProvider: vscode.TextDocumentContentProvider =
        {
            provideTextDocumentContent: (uri: vscode.Uri): string => {
                return (
                    this.inspectHealthDocuments.get(uri.toString()) ?? 'null'
                );
            },
        };

    constructor(private readonly containersManager: ContainersManager) {}

    public activate(): void {
        this.disposables.collect(
            vscode.workspace.registerTextDocumentContentProvider(
                TargetHealth.inspectTargetHealthScheme,
                this.inspectHealthContentProvider,
            ),
        );
    }

    public async inspectHealthCommandHandler(treeNode: unknown): Promise<void> {
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

        const targetState = await this.containersManager.getTargetState(
            treeNode.target,
        );
        const content = JSON.stringify(targetState.health ?? null, null, 4);
        const safeTargetSsh = treeNode.target.replace(/[^a-zA-Z0-9._-]/g, '_');
        const documentUri = vscode.Uri.from({
            scheme: TargetHealth.inspectTargetHealthScheme,
            path: `/${safeTargetSsh}-health-${Date.now()}.json`,
        });

        this.inspectHealthDocuments.clear();
        this.inspectHealthDocuments.set(documentUri.toString(), content);

        const document = await vscode.workspace.openTextDocument(documentUri);
        await vscode.window.showTextDocument(document, { preview: true });
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
