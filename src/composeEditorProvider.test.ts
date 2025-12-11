import * as vscode from 'vscode';
import * as path from 'path';
import { ComposeEditorProvider, DeployerType } from './composeEditorProvider';
import { ConfigMetadata, ProjectDescription } from './util/types';
import * as manifest from './manifest';
import { logger } from './util/logger';
import { MessageHandler, MessageHandlerTopoCli } from './messageHandler';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('./util/logger');

describe('ComposeEditorProvider', () => {
    const configMetadata: ConfigMetadata = {
        boards: [
            {
                id: "NXP i.MX 93",
                subsystems: [
                    {
                        id: "Ambient",
                        runtime: manifest.BOARD_AMBIENT_RUNTIME,
                        annotations: {
                            "remoteproc.mcu": "imx-rproc"
                        }
                    }
                ]
            }
        ]
    };
    const project: ProjectDescription = {
        name: 'test-project',
        services: {
            text: {
                build: {
                    context: './test'
                },
                containerName: 'test-container'
            }
        }
    };
    let topoCli: jest.Mocked<MessageHandlerTopoCli>;
    let provider: ComposeEditorProvider;
    let deployer: jest.Mocked<DeployerType>;
    const context: any = { extensionPath: '/ext', extensionUri: vscode.Uri.file('/ext'), subscriptions: [] };
    let onExitCallback: ((e: number | null) => any) | undefined;
    let messageHandler: MessageHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        topoCli = {
            getProject: jest.fn().mockReturnValue(project),
            getConfigMetadata: jest.fn().mockReturnValue(configMetadata),
        };
        deployer = {
            start: jest.fn(),
            stop: jest.fn(),
            onStdoutData: jest.fn(),
            onStderrData: jest.fn(),
            onExit: jest.fn(cb => {
                onExitCallback = cb;
                return { dispose: jest.fn() };
            }),
            onError: jest.fn(),
        };
        (vscode.workspace.fs.writeFile as jest.Mock) = jest.fn().mockResolvedValue(undefined);
        messageHandler = new MessageHandler(topoCli, deployer);
        provider = new ComposeEditorProvider(context, messageHandler);
    });

    it('registers custom editor provider', async () => {
        const mockReg = jest.fn(() => ({ dispose: jest.fn() }));
        vscode.window.registerCustomEditorProvider = mockReg;
        const composeEditorProvider = new ComposeEditorProvider(context, messageHandler);

        await composeEditorProvider.activate();

        expect(mockReg).toHaveBeenCalledWith(
            ComposeEditorProvider.viewType,
            provider,
            {
                webviewOptions:
        {
            retainContextWhenHidden: true
        },
            },
        );
    });

    it('posts init message with services', async () => {
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/f.yaml' }, getText: () => 'hi' };
        const post = jest.fn();
        let handler: any;
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        await handler({ type: 'compose-editor-webview-ready' });

        expect(post).toHaveBeenCalledWith({
            type: 'render-compose-editor', project, configMetadata,
        });
    });

    it('sets webview options correctly', async () => {
        const doc: any = {
            uri: { toString: () => '', fsPath: '/ext/a.yaml' },
            getText: () => ''
        };
        const post = jest.fn();
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (_cb: any) => { },
                asWebviewUri: (uri: vscode.Uri) => uri.toString()
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };

        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        expect(webviewPanel.webview.options.enableScripts).toBe(true);
        const roots = webviewPanel.webview.options.localResourceRoots;
        expect(Array.isArray(roots)).toBe(true);
        expect(roots[0].fsPath).toContain(
            path.join(context.extensionPath, 'dist')
        );
    });

    it('handles deploy message and posts deploy-complete', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'd.yaml');
        const doc: any = { uri: { toString: () => 'u', fsPath: composeFilePath }, getText: () => '' };
        let handler: any;
        const post = jest.fn();
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            const token = {
                onCancellationRequested: (cb2: any) => cb2(),
            };
            await cb({}, token);
        });
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        handler({ type: 'deploy' });
        onExitCallback?.(0);

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles deploy cancellation', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'd.yaml');
        const doc: any = { uri: { toString: () => 'u', fsPath: composeFilePath}, getText: () => '' };
        let handler: any;
        const post = jest.fn();
        let cancellationCallback: any;
        let token: any;
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            token = {
                onCancellationRequested: (cb2: any) => {
                    cancellationCallback = cb2;
                },
            };
            await cb({}, token);
        });

        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };

        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        handler({ type: 'deploy' });
        // simulate cancellation explicitly
        cancellationCallback();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('logs stdout and stderr and shows output channel during deploy', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'd.yaml');
        const doc: any = { uri: { toString: () => 'u', fsPath: composeFilePath}, getText: () => '' };
        let handler: ((msg: any) => void) | undefined;
        const post = jest.fn();
        let onStdout: ((data: Buffer) => void) | undefined;
        let onStderr: ((data: Buffer) => void) | undefined;
        // Mock deployer event registration
        (deployer.onStdoutData as jest.Mock).mockImplementation((cb: (data: Buffer) => void) => {
            onStdout = cb;
            return { dispose: jest.fn() };
        });
        deployer.onStderrData.mockImplementation(cb => {
            onStderr = cb;
            return { dispose: jest.fn() };
        });
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (_opts, cb) => {
            await cb({}, { onCancellationRequested: () => {} });
        });
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        handler?.({ type: 'deploy' });
        // Simulate stdout and stderr events
        onStdout?.(Buffer.from('hello stdout'));
        onStderr?.(Buffer.from('hello stderr'));
        onExitCallback?.(0); // Simulate successful exit

        expect(logger.info).toHaveBeenCalledWith('hello stdout');
        expect(logger.error).toHaveBeenCalledWith('hello stderr');
        expect(logger.show).toHaveBeenCalled();
    });

    it('warns on unknown message type', async () => {
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/unknown.yaml' }, getText: () => '' };
        let handler: any;
        const post = jest.fn();
        const webviewPanel: any = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await handler({ type: 'not-a-real-type' });

        expect(warnSpy).toHaveBeenCalledWith('Unknown message type: not-a-real-type');
    });

});
