import * as vscode from 'vscode';
import * as path from 'path';
import { ComposeEditorProvider, DeployerType } from './composeEditorProvider';
import { ConfigMetadata, ProjectDescription, TemplateDescription } from './util/types';
import * as manifest from './manifest';
import { logger } from './util/logger';
import { MessageHandler, MessageHandlerTopoCli } from './messageHandler';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('vscode');
jest.mock('./util/logger');

describe('ComposeEditorProvider', () => {
    const templates: TemplateDescription[] = [
        {
            id: 'p',
            url: 'u',
            subsystem: 'Host',
            ports: [],
        }];
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
            listTemplates: jest.fn().mockReturnValue(templates),
            getProject: jest.fn().mockReturnValue(project),
            addService: jest.fn().mockReturnValue(undefined),
            removeService: jest.fn().mockReturnValue(undefined),
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
            type: 'render-compose-editor', text: 'hi', project, templates, configMetadata,
        });
    });

    it('invokes generate when requested', async () => {
        const filePath = path.resolve('/ext', 'f.yaml');
        const serviceName = 'newService';
        const templateId = 'template1';
        const doc: any = { uri: { toString: () => 'u', fsPath: filePath }, getText: () => '' };
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

        handler({ type: 'add-service', filePath, serviceName, templateId });

        expect(topoCli.addService).toHaveBeenCalledWith(
            filePath,
            templateId,
            serviceName,
        );
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

    it('handles failure to gather templates', async () => {
        const error = new Error('fail-load');
        topoCli.listTemplates.mockImplementation(() => { throw error; });
        const showErr = jest.fn();
        (vscode.window.showErrorMessage as jest.Mock) = showErr;
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/fail.yaml' }, getText: () => 'foo' };
        let handler: any;
        const webviewPanel: any = {
            webview: {
                options: {}, html: '', postMessage: jest.fn(),
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        await expect(handler({ type: 'compose-editor-webview-ready' })).rejects.toThrow('fail-load');
    });

    it('shows error when add-service fails', async () => {
    // simulate add-service rejection
        const genError = new Error('add-service-fail');
        topoCli.addService.mockRejectedValue(genError);
        const showErr = jest.fn();
        (vscode.window.showErrorMessage as jest.Mock) = showErr;
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/x.yaml' }, getText: () => '' };
        let handler: any;
        const webviewPanel: any = {
            webview: {
                options: {}, html: '', postMessage: jest.fn(),
                onDidReceiveMessage: (cb: any) => { handler = cb; },
                asWebviewUri: (uri: any) => uri
            },
            onDidDispose: (_cb: any) => ({ dispose: jest.fn() })
        };
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        handler({ type: 'add-service' });
        await Promise.resolve();

        expect(topoCli.addService).toHaveBeenCalled();
        expect(showErr).toHaveBeenCalledWith(`Script error: ${genError.message}`);
    });

    it('handles remove-service message and updates', async () => {
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/r.yaml' }, getText: () => '' };
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
        handler({ type: 'compose-editor-webview-ready' });

        handler({ type: 'remove-service', serviceName: 'text' });

        expect(topoCli.removeService).toHaveBeenCalledWith(doc.uri.fsPath, 'text');
        expect(post).toHaveBeenCalled();
    });

    it('handles show-quick-pick and posts result', async () => {
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/q.yaml' }, getText: () => '' };
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
        (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('picked');
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        await handler({ type: 'show-quick-pick', items: ['picked', 'other'] });

        expect(post).toHaveBeenCalledWith({ type: 'quick-pick-result', result: 'picked' });
    });

    it('handles create-quick-pick and posts result', async () => {
        const doc: any = { uri: { toString: () => 'u', fsPath: '/ext/cqp.yaml' }, getText: () => '' };
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
        // Mock createQuickPick
        const mockQp = {
            title: '',
            matchOnDescription: false,
            items: [],
            value: 'chosen',
            selectedItems: [{ label: 'chosen' }],
            onDidAccept: (cb: any) => { mockQp._accept = cb; },
            onDidHide: (cb: any) => { mockQp._hide = cb; },
            show: jest.fn(),
            hide: jest.fn(),
            _accept: undefined as any,
            _hide: undefined as any,
        };
        (vscode.window.createQuickPick as jest.Mock).mockReturnValue(mockQp);
        await provider.resolveCustomTextEditor(doc, webviewPanel, null as any);

        const promise = handler({ type: 'create-quick-pick', items: ['chosen'], placeholder: 'Pick one' });
        mockQp._accept();
        await promise;

        expect(post).toHaveBeenCalledWith({ type: 'quick-pick-result', result: 'chosen' });
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
