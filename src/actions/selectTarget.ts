import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TargetStore } from '../target/targetStore';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { logger } from '../util/logger';

export class SelectTarget {
    public static readonly selectTargetCommand = `${manifest.PACKAGE_NAME}.selectTarget`;

    private disposables: vscode.Disposable[] = [];

    constructor(private readonly targetStore: TargetStore) {}

    public activate(): void {
        this.disposables.push(
            vscode.commands.registerCommand(
                SelectTarget.selectTargetCommand,
                (node: unknown) => this.selectTarget(node),
            ),
        );
    }

    private async selectTarget(treeNode: unknown): Promise<void> {
        if (!(treeNode instanceof TargetTreeItem)) {
            const errMsg = `Invalid target type for select: expected TargetTreeItem but received:`;
            logger.error(errMsg, treeNode);
            return;
        }

        await this.targetStore.setSelected(treeNode.target);
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
