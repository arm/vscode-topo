import * as vscode from 'vscode';
import { Deploy } from './actions/deploy';
import { logger } from './util/logger';
import { getErrorMessage } from './util/getErrorMessage';
import { isPlainObject } from './util/isPlainObject';
import { MessagePoster } from './util/types';
import { showAndLogError } from './util/showAndLogError';
import { TopoCli } from './topoCli';
import { TargetStore } from './workloadPlacement/targetStore';
import { TargetDescriptionStore } from './workloadPlacement/targetDescriptionStore';

type ShowQuickPickMessage = { type: 'show-quick-pick'; items: string[] };
type CreateQuickPickMessage = {
    type: 'create-quick-pick';
    items: string[];
    placeholder: string;
};
type DeployMessage = { type: 'deploy' };
type ComposeEditorWebviewReadyMessage = {
    type: 'compose-editor-webview-ready';
};

type WebviewMessage =
    | ShowQuickPickMessage
    | CreateQuickPickMessage
    | DeployMessage
    | ComposeEditorWebviewReadyMessage;

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
}

function parseWebviewMessage(value: unknown): WebviewMessage {
    if (!isPlainObject(value) || typeof value.type !== 'string') {
        throw new Error(
            'Invalid webview message: expected an object with a string "type" property',
        );
    }

    switch (value.type) {
        case 'show-quick-pick':
            if (!isStringArray(value.items)) {
                throw new Error(
                    'Invalid show-quick-pick message: "items" must be string[]',
                );
            }
            return { type: value.type, items: value.items };

        case 'create-quick-pick':
            if (
                !isStringArray(value.items) ||
                typeof value.placeholder !== 'string'
            ) {
                throw new Error(
                    'Invalid create-quick-pick message: "items" must be string[] and "placeholder" must be string',
                );
            }
            return {
                type: value.type,
                items: value.items,
                placeholder: value.placeholder,
            };

        case 'deploy':
        case 'compose-editor-webview-ready':
            return { type: value.type };

        default:
            throw new Error(
                `Invalid webview message: unknown type "${value.type}"`,
            );
    }
}

export class ComposeEditorMessageHandler {
    constructor(
        private readonly topoCli: TopoCli,
        private readonly deploy: Deploy,
        private readonly targetStore: TargetStore,
        private readonly targetDescriptionStore: TargetDescriptionStore,
    ) {}

    public async renderComposeEditor(
        messagePoster: MessagePoster,
        document: vscode.TextDocument,
    ): Promise<void> {
        const project = this.topoCli.getProject(document.uri.fsPath);
        const target = await this.targetStore.getSelectedTarget();
        const description = target
            ? await this.targetDescriptionStore.getDescription(target)
            : undefined;
        const remoteprocCpus =
            description?.remoteprocCPU.map((rp) => rp.name) || [];
        const subsystemNames = ['Host', ...remoteprocCpus];
        messagePoster.postMessage({
            type: 'render-compose-editor',
            project,
            subsystems: subsystemNames,
        });
    }

    private async handleShowQuickPick(
        messagePoster: MessagePoster,
        messageItems: string[],
    ): Promise<void> {
        let result: unknown;
        try {
            result = await vscode.window.showQuickPick(messageItems);
        } finally {
            messagePoster.postMessage({
                type: 'quick-pick-result',
                result,
            });
        }
    }

    private async handleCreateQuickPick(
        messagePoster: MessagePoster,
        items: string[],
        placeholder: string,
    ): Promise<void> {
        let result: unknown;
        try {
            result = await new Promise((resolve) => {
                const qp = vscode.window.createQuickPick();

                qp.title = placeholder;
                qp.matchOnDescription = true;
                qp.items = items.map((label) => ({ label }));

                qp.onDidAccept(() => {
                    const text = qp.value.trim();
                    resolve(
                        qp.selectedItems.length
                            ? qp.selectedItems[0].label
                            : text,
                    );
                    qp.dispose();
                });

                qp.onDidHide(() => {
                    resolve(undefined);
                    qp.dispose();
                });
                qp.show();
            });
        } finally {
            messagePoster.postMessage({
                type: 'quick-pick-result',
                result,
            });
        }
    }

    private async handleDeploy(
        messagePoster: MessagePoster,
        documentPath: string,
    ) {
        try {
            await this.deploy.deploy(documentPath);
        } catch (err) {
            const errorMsg = 'Error during deployment';
            logger.error(errorMsg, err);
            vscode.window.showErrorMessage(
                `${errorMsg}: ${getErrorMessage(err)}`,
            );
        } finally {
            messagePoster.postMessage({ type: 'deploy-complete' });
        }
    }

    public async handleMessage(
        messagePoster: MessagePoster,
        document: vscode.TextDocument,
        e: unknown,
    ): Promise<void> {
        try {
            const message = parseWebviewMessage(e);
            switch (message.type) {
                case 'show-quick-pick':
                    await this.handleShowQuickPick(
                        messagePoster,
                        message.items,
                    );
                    return;

                case 'create-quick-pick':
                    await this.handleCreateQuickPick(
                        messagePoster,
                        message.items,
                        message.placeholder,
                    );
                    return;

                case 'deploy':
                    await this.handleDeploy(messagePoster, document.uri.fsPath);
                    return;

                case 'compose-editor-webview-ready':
                    await this.renderComposeEditor(messagePoster, document);
                    return;
            }
        } catch (err) {
            const errorMsg =
                'Unexpected error handling message from compose editor webview';
            showAndLogError(errorMsg, err);
        }
    }
}
