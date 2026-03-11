import * as vscode from 'vscode';
import { TargetDashboardMessageHandler } from './targetDashboardMessageHandler';
import { ContainersManager } from '../workloadPlacement/containersManager';
import { PACKAGE_NAME } from '../manifest';

export class TargetDashboardProvider {
    public static readonly viewType = `${PACKAGE_NAME}.targetDashboard`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly messageHandler: TargetDashboardMessageHandler,
        private readonly containersManager: ContainersManager,
    ) {}

    public async activate(): Promise<void> {}

    public showDashboard(): void {
        const webviewPanel = vscode.window.createWebviewPanel(
            TargetDashboardProvider.viewType,
            'Target Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );
        webviewPanel.webview.html = this.getHtmlForWebview(
            webviewPanel.webview,
        );

        const dataUpdateDisposable = this.containersManager.onDataUpdate(() => {
            this.messageHandler.renderTargetDashboard(webviewPanel.webview);
        });

        const onMessageReceiveDisposable =
            webviewPanel.webview.onDidReceiveMessage((e) =>
                this.messageHandler.handleMessage(webviewPanel.webview, e),
            );
        webviewPanel.onDidDispose(() => {
            dataUpdateDisposable.dispose();
            onMessageReceiveDisposable.dispose();
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'main.js'),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'main.css'),
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <link href="https://microsoft.github.io/vscode-codicons/dist/codicon.css" rel="stylesheet" />
  <title>Target Dashboard</title>
</head>
<body>
  <div id="target-dashboard"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
