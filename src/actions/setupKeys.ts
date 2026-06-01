import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { showAndLogError } from '../util/showAndLogError';
import { executeTask } from '../util/executeTask';
import { TargetModel } from '../models/targetModel';
import { TopoCli } from '../topoCli';

export class SetupKeys {
    public static readonly setupKeysCommand = `${PACKAGE_NAME}.setupKeys`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                SetupKeys.setupKeysCommand,
                this.setupKeysCommandHandler.bind(this),
            ),
        );
    }

    private async setupKeysCommandHandler(treeNode: unknown): Promise<void> {
        if (treeNode instanceof TargetTreeItem) {
            if (!treeNode.contextValue?.includes('Selected')) {
                return;
            }
            await setupKeys(this.topoCli.getBinaryPath(), treeNode.target);
            return;
        }

        const selectedTarget = this.targetModel.selected;
        if (!selectedTarget) {
            showAndLogError(
                'Failed to set up keys on target',
                new Error('No selected target found'),
            );
            return;
        }
        await setupKeys(this.topoCli.getBinaryPath(), selectedTarget);
    }
}

export async function setupKeys(
    topoBinaryPath: string,
    ssh: string,
): Promise<void> {
    try {
        await executeTask(`Setup keys on ${ssh}`, [
            topoBinaryPath,
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
