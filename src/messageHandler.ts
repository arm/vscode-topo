import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { Deploy } from './actions/deploy';

export type MessageHandlerTopoCli = Pick<TopoCli, 'getProject' | 'getConfigMetadata' >;

export class MessageHandler {
    constructor(
      private readonly topoCli: MessageHandlerTopoCli,
      private readonly deploy: Pick<Deploy, 'deploy'>,
    ) {}

    public renderComposeEditor(
        webview: vscode.Webview,
        document: vscode.TextDocument,
    ): void {
        const project = this.topoCli.getProject(document.uri.fsPath);
        const configMetadata = this.topoCli.getConfigMetadata();
        webview.postMessage({
            type: 'render-compose-editor',
            project,
            configMetadata,
        });
    }

    private handleShowQuickPick(
        items: string[]
    ): Promise<string | undefined> {
        return new Promise((resolve) => {
            vscode.window.showQuickPick(items).then(selected => {
                resolve(selected);
            });
        });
    }

    private handleCreateQuickPick(
        items: string[],
        placeholder: string,
    ): Promise<string | undefined> {
        return new Promise(resolve => {
            const qp = vscode.window.createQuickPick();

            qp.title = placeholder;
            qp.matchOnDescription = true;
            qp.items = items.map(label => ({ label }));

            qp.onDidAccept(() => {
                const text = qp.value.trim();
                resolve(qp.selectedItems.length ? qp.selectedItems[0].label : text);
                qp.hide();
            });

            qp.onDidHide(() => resolve(undefined)); // Esc / focus-out
            qp.show();
        });
    }

    /**
     * Handle incoming messages from the webview
     */
    public async handleMessage(
        webview: vscode.Webview,
        document: vscode.TextDocument,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e: any
    ): Promise<void> {
        switch (e.type) {
        case 'show-quick-pick':
            try {
                const result = await this.handleShowQuickPick(e.items);
                if (result) {
                    webview.postMessage({
                        type: 'quick-pick-result',
                        result,
                    });
                }
            } catch (err) {
                console.error('Error in show-quick-pick:', err);
            }
            break;
        case 'create-quick-pick':
            try {
                const result = await this.handleCreateQuickPick(e.items, e.placeholder);
                if (result) {
                    webview.postMessage({
                        type: 'quick-pick-result',
                        result,
                    });
                }
            } catch (err) {
                console.error('Error in create-quick-pick:', err);
            }
            break;
        case 'deploy':
            try {
                await this.deploy.deploy(document.uri.fsPath);
            } catch (err) {
                console.error('Error in deploy:', err);
            }
            finally {
                webview.postMessage({
                    type: 'deploy-complete',
                });
            }
            break;
        case 'compose-editor-webview-ready':
            this.renderComposeEditor(webview, document);
            break;
        default:
            console.warn(`Unknown message type: ${e.type}`);
        }
    }
}
