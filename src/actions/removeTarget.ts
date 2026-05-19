import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { logger } from '../util/logger';

export class RemoveTarget {
    public static readonly removeTargetCommand = `${manifest.PACKAGE_NAME}.removeTarget`;

    private disposables: vscode.Disposable[] = [];

    constructor(private readonly targetStore: TargetStore) {}

    public activate(): void {
        this.disposables.push(
            vscode.commands.registerCommand(
                RemoveTarget.removeTargetCommand,
                (node: unknown) => this.removeTarget(node),
            ),
        );
    }

    private async removeTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeItem)) {
            const errMsg = `Invalid target type for remove: expected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        try {
            await this.targetStore.deleteTarget(treeNode.target);
        } catch (err) {
            const errorMessage = `Failed to remove target`;
            vscode.window.showErrorMessage(errorMessage);
            logger.error(errorMessage, err);
        }
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
