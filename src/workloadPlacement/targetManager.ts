import * as vscode from 'vscode';
import { TargetTreeDataProvider } from './targetTreeDataProvider';
import * as manifest from '../manifest';

export class TargetManager {

    public static readonly TargetManagerViewId = `${manifest.PACKAGE_NAME}.target-manager`;
    public static readonly RefreshCommandType = `${manifest.PACKAGE_NAME}.refresh`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetTreeDataProvider: TargetTreeDataProvider,
    ) {}

    public async activate() {
        const treeView = vscode.window.createTreeView(TargetManager.TargetManagerViewId, {
            treeDataProvider: this.targetTreeDataProvider,
            showCollapseAll: true
        });

        this.context.subscriptions.push(
            treeView,
            vscode.commands.registerCommand(TargetManager.RefreshCommandType, () => this.targetTreeDataProvider.refresh()),
        );
    }

}
