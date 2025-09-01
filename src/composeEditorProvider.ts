import * as vscode from 'vscode';
import * as path from 'path';
import * as manifest from './manifest';
import { Deployer } from './deployer';
import { MessageHandler } from './messageHandler';

export type DeployerType = Pick<Deployer, 'start' | 'stop' | 'onStdoutData' | 'onStderrData' | 'onExit' | 'onError'>;

const isUri = (uri: unknown): uri is vscode.Uri => (uri as vscode.Uri).path !== undefined;

export class ComposeEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = `${manifest.PACKAGE_NAME}.composeEditor`;
    public static readonly sourceCommandType = `${manifest.PACKAGE_NAME}.showSource`;
    public static readonly previewCommandType = `${manifest.PACKAGE_NAME}.showPreview`;
    public static readonly sidePreviewCommandType = `${manifest.PACKAGE_NAME}.showPreviewToSide`;

    private readonly views = new Map<string, vscode.WebviewPanel>();
    private readonly documents = new Map<string, vscode.TextDocument>();
    private lastViewColumn: vscode.ViewColumn | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
    private readonly messageHandler: MessageHandler,
    ) {}

    public async activate(): Promise<void> {
        const editorOptions = {
            webviewOptions: {
                retainContextWhenHidden: true
            },
        };
        this.context.subscriptions.push(
            vscode.window.registerCustomEditorProvider(
                ComposeEditorProvider.viewType,
                this,
                editorOptions,
            ),
            vscode.commands.registerCommand(
                ComposeEditorProvider.sourceCommandType,
                () => this.source(),
            ),
            vscode.commands.registerCommand(
                ComposeEditorProvider.sidePreviewCommandType,
                async (uri: vscode.Uri | undefined) => this.preview(uri, true),
            ),
            vscode.commands.registerCommand(
                ComposeEditorProvider.previewCommandType,
                async (uri: vscode.Uri | undefined) => this.preview(uri)
            ),
        );
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.createWebview(webviewPanel, document);
    }

    private createWebview(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument) {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'dist')),
                vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        this.views.set(document.uri.toString(), webviewPanel);

        const changeDocSub = this.subscribeToDocumentChanges(
            webviewPanel,
            document
        );

        const onMessageReceiveDisposable = webviewPanel.webview.onDidReceiveMessage(
            e => this.messageHandler.handleMessage(webviewPanel.webview, document, e)
        );

        webviewPanel.onDidDispose(() => {
            this.views.delete(document.uri.toString());
            changeDocSub.dispose();
            onMessageReceiveDisposable.dispose();
        });
    }

    protected async preview(uri: vscode.Uri | undefined, openToSide = false): Promise<void> {
        uri = isUri(uri) ? uri : vscode.window.activeTextEditor?.document.uri;
        this.lastViewColumn = vscode.window.activeTextEditor?.viewColumn;

        if (!uri) {
            return;
        }

        let document: vscode.TextDocument | undefined;
        try {
            await vscode.workspace.fs.stat(uri);
            document = await vscode.workspace.openTextDocument(uri);
            this.documents.set(document.uri.toString(), document);
        } catch {
            // File doesn't exist
        }
        if (!document) {
            vscode.window.showErrorMessage(`Cannot open document: ${uri.toString()}`);
            return;
        }

        const webview = this.views.get(uri.toString());

        if (webview) {
            webview.reveal();
        } else {
            const webviewPanel = vscode.window.createWebviewPanel(
                ComposeEditorProvider.viewType,
                path.basename(uri.fsPath),
                openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active
            );
            await this.createWebview(webviewPanel, document);
        }
    }
  
    protected async source(): Promise<void> {
        const views = [...this.views.entries()];
        const activeView = views.find(([_uri, view]) => view.active);
        if (activeView) {
            const [uri] = activeView;
            vscode.window.showTextDocument(
                vscode.Uri.parse(uri),
                { viewColumn: this.lastViewColumn },
            );
        }
    }

    /**
     *  Subscribe to document changes and forward updates
     */ 
    private subscribeToDocumentChanges(
        panel: vscode.WebviewPanel,
        document: vscode.TextDocument,
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.messageHandler.renderComposeEditor(panel.webview, document);
            }
        });
    }

    /**
     *  Generate the HTML to load into the webview
     */
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
  <title>Compose Editor</title>
</head>
<body>
  <div id="compose-editor"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
