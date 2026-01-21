import * as vscode from 'vscode';
import * as path from 'path';
import { ComposeEditorProvider } from './composeEditorProvider';
import { ConfigMetadata, ProjectDescription } from './util/types';
import * as manifest from './manifest';
import { MessageHandler, MessageHandlerTopoCli } from './messageHandler';
import { Deploy } from './actions/deploy';
import { logger } from './util/logger';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('./util/logger');

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

describe('ComposeEditorProvider', () => {
    const configMetadata: ConfigMetadata = {
        boards: [
            {
                id: 'NXP i.MX 93',
                subsystems: [
                    {
                        id: 'Ambient',
                        runtime: manifest.BOARD_AMBIENT_RUNTIME,
                        annotations: {
                            'remoteproc.mcu': 'imx-rproc',
                        },
                    },
                ],
            },
        ],
    };
    const project: ProjectDescription = {
        name: 'test-project',
        services: {
            text: {
                build: {
                    context: './test',
                },
                containerName: 'test-container',
            },
        },
    };
    let topoCli: jest.Mocked<MessageHandlerTopoCli>;
    let provider: ComposeEditorProvider;
    let deploy: jest.Mocked<Pick<Deploy, 'deploy'>>;
    const context: any = {
        extensionPath: '/ext',
        extensionUri: vscode.Uri.file('/ext'),
        subscriptions: [],
    };
    let messageHandler: MessageHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        topoCli = {
            getProject: jest.fn().mockReturnValue(project),
            getConfigMetadata: jest.fn().mockReturnValue(configMetadata),
        };
        (vscode.workspace.fs.writeFile as jest.Mock) = jest
            .fn()
            .mockResolvedValue(undefined);
        deploy = {
            deploy: jest.fn().mockResolvedValue(undefined),
        };
        messageHandler = new MessageHandler(topoCli, deploy);
        provider = new ComposeEditorProvider(context, messageHandler);
    });

    it('registers custom editor provider', async () => {
        const mockReg = jest.fn(() => ({ dispose: jest.fn() }));
        vscode.window.registerCustomEditorProvider = mockReg;
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            messageHandler,
        );

        await composeEditorProvider.activate();

        expect(mockReg).toHaveBeenCalledWith(
            ComposeEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            },
        );
    });

    it('posts init message with services', async () => {
        const doc: any = {
            uri: { toString: () => 'u', fsPath: '/ext/f.yaml' },
            getText: () => 'hi',
        };
        const post = jest.fn();
        let handler: any;
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => {
                    handler = cb;
                },
                asWebviewUri: (uri: any) => uri,
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() }),
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        await handler({ type: 'compose-editor-webview-ready' });

        expect(post).toHaveBeenCalledWith({
            type: 'render-compose-editor',
            project,
            configMetadata,
        });
    });

    it('sets webview options correctly', async () => {
        const doc: any = {
            uri: { toString: () => '', fsPath: '/ext/a.yaml' },
            getText: () => '',
        };
        const post = jest.fn();
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (_cb: any) => {},
                asWebviewUri: (uri: vscode.Uri) => uri.toString(),
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() }),
        };

        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        expect(webviewPanel.webview.options.enableScripts).toBe(true);
        const roots = webviewPanel.webview.options.localResourceRoots;
        expect(Array.isArray(roots)).toBe(true);
        expect(roots[0].fsPath).toContain(
            path.join(context.extensionPath, 'dist'),
        );
    });

    it('handles successful deploy and posts deploy-complete', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        const doc: any = {
            uri: { toString: () => 'u', fsPath: composeFilePath },
            getText: () => '',
        };
        let handler: any;
        const post = jest.fn();
        (vscode.window.withProgress as jest.Mock).mockImplementation(
            async (_opts, cb) => {
                const token = {
                    onCancellationRequested: (cb2: any) => cb2(),
                };
                await cb({}, token);
            },
        );
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => {
                    handler = cb;
                },
                asWebviewUri: (uri: any) => uri,
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() }),
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        handler({ type: 'deploy' });
        await waitImmediate();
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles unsuccessful deploy and posts deploy-complete', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        const doc: any = {
            uri: { toString: () => 'u', fsPath: composeFilePath },
            getText: () => '',
        };
        let handler: any;
        const post = jest.fn();
        (vscode.window.withProgress as jest.Mock).mockImplementation(
            async (_opts, cb) => {
                const token = {
                    onCancellationRequested: (cb2: any) => cb2(),
                };
                await cb({}, token);
            },
        );
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => {
                    handler = cb;
                },
                asWebviewUri: (uri: any) => uri,
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() }),
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);
        const error = new Error('deploy-fail');
        deploy.deploy.mockRejectedValueOnce(error);

        handler({ type: 'deploy' });
        await waitImmediate();

        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
        expect(logger.error).toHaveBeenCalledWith(
            'Error during deployment',
            error,
        );
        expect(
            vscode.window.showErrorMessage as jest.Mock,
        ).toHaveBeenCalledWith('Error during deployment: deploy-fail');
    });

    it('warns on unknown message type', async () => {
        const doc: any = {
            uri: { toString: () => 'u', fsPath: '/ext/unknown.yaml' },
            getText: () => '',
        };
        let handler: any;
        const post = jest.fn();
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => {
                    handler = cb;
                },
                asWebviewUri: (uri: any) => uri,
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() }),
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        await handler({ type: 'not-a-real-type' });

        expect(logger.warn).toHaveBeenCalledWith(
            'Unknown message type: not-a-real-type',
        );
    });
});
