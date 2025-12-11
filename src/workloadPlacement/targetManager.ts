import * as vscode from 'vscode';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';
import { Target } from './target';
import { TargetStore } from './targetStore';
import { getErrorMessage } from '../util/getErrorMessage';
import { logger } from '../util/logger';

export class TargetManager {

    public static readonly TargetManagerViewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly RefreshCommandType = `${manifest.PACKAGE_NAME}.refresh`;
    public static readonly AddTargetCommandType = `${manifest.PACKAGE_NAME}.addTarget`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetTreeDataProvider: TargetTreeDataProvider,
        private readonly targetStore: Pick<TargetStore, 'addTarget' | 'setSelected'>,
    ) {}

    public async activate() {
        const treeView = vscode.window.createTreeView(TargetManager.TargetManagerViewId, {
            treeDataProvider: this.targetTreeDataProvider,
            showCollapseAll: true
        });

        this.context.subscriptions.push(
            treeView,
            vscode.commands.registerCommand(TargetManager.RefreshCommandType, () => this.targetTreeDataProvider.refresh()),
            vscode.commands.registerCommand(TargetManager.AddTargetCommandType, () => this.addTarget()),
        );
    }

    private async addTarget(): Promise<Target | undefined> {
        const ssh = await vscode.window.showInputBox({
            title: 'Enter a connection string for the target',
            placeHolder: 'root@192.168.1.1'
        });
        if (!ssh?.trim()) {
            return;
        }

        const id = await vscode.window.showInputBox({
            title: 'Enter a unique id for the target',
            placeHolder: ssh
        });
        if (!id?.trim()) {
            return;
        }

        const newTarget = new Target(id, ssh);

        try {
            await this.targetStore.addTarget(newTarget);
        } catch (error) {
            const errorMsg = `Failed to add target: ${getErrorMessage(error)}`;
            logger.warn(errorMsg);
            vscode.window.showWarningMessage(errorMsg);
            return;
        }
        await this.targetStore.setSelected(newTarget.id);
    }

}
