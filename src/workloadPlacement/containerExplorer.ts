import * as vscode from 'vscode';
import { ContainerTreeDataProvider } from './containerTreeDataProvider';

export class ContainerExplorer {
    constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly containerTreeDataProvider: ContainerTreeDataProvider
    ) {}

    public async activate() {
        const treeView = vscode.window.createTreeView('containerExplorer', {
            treeDataProvider: this.containerTreeDataProvider,
            showCollapseAll: true
        });

        this.context.subscriptions.push(
            treeView,
            vscode.commands.registerCommand("containerExplorer.refresh", () => this.containerTreeDataProvider.refresh()),
        );
    }

}
