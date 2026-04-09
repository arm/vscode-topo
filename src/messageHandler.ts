import * as vscode from 'vscode';
import { logger } from './util/logger';
import { DeployerType } from './composeEditorProvider';
import { TopoCli } from './topoCli';

export type MessageHandlerTopoCli = Pick<TopoCli, 'listTemplates' | 'getProject' | 'addService' | 'getConfigMetadata' | 'removeService'>;

export class MessageHandler {
    constructor(
      private readonly topoCli: MessageHandlerTopoCli,
      private readonly deployer: DeployerType,
    ) {}

    public renderComposeEditor(
        webview: vscode.Webview,
        document: vscode.TextDocument,
    ): void {
        const templates = this.topoCli.listTemplates();
        const project = this.topoCli.getProject(document.uri.fsPath);
        const configMetadata = this.topoCli.getConfigMetadata();
        webview.postMessage({
            type: 'render-compose-editor',
            text: document.getText(),
            project,
            templates,
            configMetadata,
        });
    }

    // Handle addService request
    private async handleAddService(document: vscode.TextDocument, templateId: string, serviceName: string): Promise<void> {
        const filePath = document.uri.fsPath;
        try {
            await this.topoCli.addService(filePath, templateId, serviceName).catch(err => {
                vscode.window.showErrorMessage(`Script error: ${err.message}`);
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to add service: ${errorMsg}`);
        }
    }

    // Handle handleRemoveService request
    private async handleRemoveService(document: vscode.TextDocument, serviceName: string): Promise<void> {
        const filePath = document.uri.fsPath;
        try {
            await this.topoCli.removeService(filePath, serviceName).catch(err => {
                vscode.window.showErrorMessage(`Script error: ${err.message}`);
            });
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to remove service: ${errorMsg}`);
        }
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
     * Handle deploy request: clean and execute makefile
     */
    private async handleDeploy(
        document: vscode.TextDocument,
        webview: vscode.Webview,
    ): Promise<void> {
        const composeFilePath = document.uri.fsPath;
        logger.show();
        logger.info('Deploy operation started');
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Deploying...',
                cancellable: true,
            },
            async (_progress, token) => {
                const disposables: vscode.Disposable[] = [];
                disposables.push(
                    this.deployer.onStdoutData((data) => {
                        logger.info(data.toString());
                    }),
                    this.deployer.onStderrData((data) => {
                        logger.error(data.toString());
                    }),
                    this.deployer.onExit((_code) => {
                        disposables.forEach(d => d.dispose());
                    }),
                    this.deployer.onError((err) => {
                        logger.error(err.message);
                        disposables.forEach(d => d.dispose());
                    }),
                );
                this.deployer.start(composeFilePath);
                token.onCancellationRequested(() => {
                    try {
                        this.deployer.stop();
                    } catch (err) {
                        logger.error('An error happened:');
                        logger.error(err);
                    }
                    webview.postMessage({
                        type: 'deploy-complete',
                    });
                });
                await new Promise<void>((resolve, reject) => {
                    this.deployer.onExit((code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Make exited with code ${code}`));
                        }
                    });
                    this.deployer.onError(reject);
                });
            }
        );
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
        case 'add-service':
            try {
                await this.handleAddService(document, e.templateId, e.serviceName);
                this.renderComposeEditor(webview, document);
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Error handling add-service: ${errorMsg}`);
            }
            break;
        case 'remove-service':
            try {
                await this.handleRemoveService(document, e.serviceName);
                this.renderComposeEditor(webview, document);
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Error handling remove-service: ${errorMsg}`);
            }
            break;
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
                await this.handleDeploy(document, webview);
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
