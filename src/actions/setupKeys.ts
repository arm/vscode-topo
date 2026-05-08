import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetStore } from '../workloadPlacement/targetStore';
import { TargetTreeTargetItem } from '../workloadPlacement/targetTreeTargetItem';
import { showAndLogError } from '../util/showAndLogError';
import { executeTask } from '../util/executeTask';

export class SetupKeys {
    public static readonly setupKeysCommand = `${PACKAGE_NAME}.setupKeys`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetStore: TargetStore,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                SetupKeys.setupKeysCommand,
                (treeNode: unknown) => this.setupKeys(treeNode),
            ),
        );
    }

    private async setupKeys(treeNode: unknown): Promise<void> {
        let ssh: string | undefined;

        if (treeNode instanceof TargetTreeTargetItem) {
            if (!treeNode.contextValue?.includes('Selected')) {
                return;
            }
            ssh = treeNode.target;
        } else {
            const selectedTarget = this.targetStore.getSelectedTarget();
            if (!selectedTarget) {
                showAndLogError(
                    'Failed to set up keys on target',
                    new Error('No selected target found'),
                );
                return;
            }
            ssh = selectedTarget;
        }
        if (!ssh) {
            return;
        }

        try {
            await executeTask(`Setup keys on ${ssh}`, [
                'topo',
                'setup-keys',
                '--target',
                ssh,
            ]);
            vscode.window.showInformationMessage(
                `Keys were set up on target ${ssh}.`,
            );
        } catch (err) {
            showAndLogError(`Failed to set up keys on target ${ssh}`, err);
        }
    }
}
