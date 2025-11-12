import * as vscode from 'vscode';
import { BoardDashboardMessageHandler } from './boardDashboardMessageHandler';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { PACKAGE_NAME } from '../manifest';

export class BoardDashboardProvider {
    public static readonly viewType = `${PACKAGE_NAME}.boardDashboard`;
    public static readonly openCommandType = `${PACKAGE_NAME}.openBoardDashboard`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly messageHandler: BoardDashboardMessageHandler,
        private readonly containersManager: ContainersManager
    ) {}

    public async activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(BoardDashboardProvider.openCommandType, () => {
                this.showDashboard();
            })
        );
    }

    public showDashboard() {
        const webviewPanel = vscode.window.createWebviewPanel(
            BoardDashboardProvider.viewType,
            'Board Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        const dataUpdateDisposable = this.containersManager.onDataUpdate(() => {
            this.messageHandler.renderBoardDashboard(webviewPanel.webview);
        });

        const onMessageReceiveDisposable = webviewPanel.webview.onDidReceiveMessage(e =>
            this.messageHandler.handleMessage(webviewPanel.webview, e)
        );
        webviewPanel.onDidDispose(() => {
            dataUpdateDisposable.dispose();
            onMessageReceiveDisposable.dispose();
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'main.js'
            )
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'main.css'
            )
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <link href="https://microsoft.github.io/vscode-codicons/dist/codicon.css" rel="stylesheet" />
  <title>Board Dashboard</title>
</head>
<body>
  <div id="board-dashboard"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
