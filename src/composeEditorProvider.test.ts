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

const waitImmediate = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0));

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
    let deployer: DeployerType;
    const context: any = { extensionPath: '/ext', extensionUri: vscode.Uri.file('/ext'), subscriptions: [] };
    let messageHandler: MessageHandler;
    let stdoutDataEmitter: vscode.EventEmitter<Buffer>;
    let stderrDataEmitter: vscode.EventEmitter<Buffer>;
    let exitEmitter: vscode.EventEmitter<number | null>;
    let errorEmitter: vscode.EventEmitter<Error>;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {/* no-op */});
        topoCli = {
            getProject: jest.fn().mockReturnValue(project),
            getConfigMetadata: jest.fn().mockReturnValue(configMetadata),
        };
        stderrDataEmitter = new vscode.EventEmitter<Buffer>();
        stdoutDataEmitter = new vscode.EventEmitter<Buffer>();
        exitEmitter = new vscode.EventEmitter<number | null>();
        errorEmitter = new vscode.EventEmitter<Error>();
        deployer = {
            start: jest.fn().mockImplementation(() => Promise.resolve()),
            stop: jest.fn(),
            onStdoutData: stdoutDataEmitter.event,
            onStderrData: stderrDataEmitter.event,
            onExit: exitEmitter.event,
            onError: errorEmitter.event,
        };
        (vscode.workspace.fs.writeFile as jest.Mock) = jest.fn().mockResolvedValue(undefined);
        messageHandler = new MessageHandler(topoCli, deployer);
        provider = new ComposeEditorProvider(context, messageHandler);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
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
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
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
        exitEmitter.fire(0); // Simulate successful exit
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles deploy cancellation', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
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
        // process would fire an exit event after being stopped
        exitEmitter.fire(130);
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles deploy process errors', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        const doc: any = { uri: { toString: () => 'u', fsPath: composeFilePath}, getText: () => '' };
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
        deployer.start = jest.fn().mockRejectedValue(new Error('deploy-fail'));

        handler({ type: 'deploy' });
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('deploy-fail'));
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles other deploy errors', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        const doc: any = { uri: { toString: () => 'u', fsPath: composeFilePath}, getText: () => '' };
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
        // simulate cancellation explicitly
        errorEmitter.fire(new Error('Simulated error'));
        await waitImmediate();

        expect(deployer.start).toHaveBeenCalledWith(composeFilePath);
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('logs stdout and stderr and shows output channel during deploy', async () => {
        const composeFolder = '/ext';
        const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
        const doc: any = { uri: { toString: () => 'u', fsPath: composeFilePath}, getText: () => '' };
        let handler: ((msg: any) => void) | undefined;
        const post = jest.fn();
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
        stdoutDataEmitter.fire(Buffer.from('hello stdout'));
        stderrDataEmitter.fire(Buffer.from('hello stderr'));
        exitEmitter.fire(0); // Simulate successful exit
        await waitImmediate();

        expect(logger.show).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('hello stdout');
        expect(logger.error).toHaveBeenCalledWith('hello stderr');
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
