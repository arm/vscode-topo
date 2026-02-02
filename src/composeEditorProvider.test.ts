import * as vscode from 'vscode';
import * as path from 'path';
import { ComposeEditorProvider } from './composeEditorProvider';
import { ConfigMetadata, ProjectDescription } from './util/types';
import * as manifest from './manifest';
import {
    ComposeEditorMessageHandler,
    MessageHandlerTopoCli,
} from './composeEditorMessageHandler';
import { Deploy } from './actions/deploy';
import { logger } from './util/logger';
import { showAndLogError } from './util/showAndLogError';

jest.mock('vscode');
jest.mock('./util/logger');
jest.mock('./util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));

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

    const composeFolder = '/ext';
    const composeFilePath = path.resolve(composeFolder, 'compose.yaml');
    const composeFileUri = vscode.Uri.file(composeFilePath);
    const doc: vscode.TextDocument = {
        uri: composeFileUri,
        getText: () => 'hi',
        fileName: '',
        isUntitled: false,
        languageId: '',
        version: 0,
        isDirty: false,
        isClosed: false,
        save: jest.fn(),
        eol: vscode.EndOfLine.LF,
        lineCount: 0,
        lineAt: jest.fn(),
        offsetAt: jest.fn(),
        positionAt: jest.fn(),
        getWordRangeAtPosition: jest.fn(),
        validateRange: jest.fn(),
        validatePosition: jest.fn(),
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
    const cancellationEventEmitter = new vscode.EventEmitter<void>();
    const cancellationToken: vscode.CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: cancellationEventEmitter.event,
    };
    let post: (arg: unknown) => Thenable<boolean>;
    let onDidReceiveMessageEmitter: vscode.EventEmitter<unknown>;
    let webviewPanel: vscode.WebviewPanel;
    let topoCli: jest.Mocked<MessageHandlerTopoCli>;
    let provider: ComposeEditorProvider;
    let deploy: jest.Mocked<Pick<Deploy, 'deploy'>>;
    const context = {
        extensionPath: '/ext',
        extensionUri: vscode.Uri.file('/ext'),
        subscriptions: [],
    };
    let composeEditorMessageHandler: ComposeEditorMessageHandler;

    beforeEach(() => {
        jest.clearAllMocks();

        post = jest.fn();
        onDidReceiveMessageEmitter = new vscode.EventEmitter<unknown>();
        webviewPanel = {
            webview: {
                options: {},
                html: '',
                postMessage: post,
                onDidReceiveMessage: onDidReceiveMessageEmitter.event,
                asWebviewUri: (uri: vscode.Uri) => uri,
                cspSource: '',
            },
            onDidDispose: (_cb: () => Promise<void>) => ({
                dispose: jest.fn(),
            }),
            viewType: '',
            title: '',
            options: {},
            viewColumn: undefined,
            active: false,
            visible: false,
            onDidChangeViewState: jest.fn(),
            reveal: jest.fn(),
            dispose: jest.fn(),
        };
        topoCli = {
            getProject: jest.fn().mockReturnValue(project),
            getConfigMetadata: jest.fn().mockReturnValue(configMetadata),
        };
        deploy = {
            deploy: jest.fn().mockResolvedValue(undefined),
        };
        composeEditorMessageHandler = new ComposeEditorMessageHandler(
            topoCli,
            deploy,
        );
        provider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
        );
    });

    it('registers custom editor provider', async () => {
        const mockReg = jest.fn(() => ({ dispose: jest.fn() }));
        vscode.window.registerCustomEditorProvider = mockReg;
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
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
        await provider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );

        onDidReceiveMessageEmitter.fire({
            type: 'compose-editor-webview-ready',
        });

        expect(post).toHaveBeenCalledWith({
            type: 'render-compose-editor',
            project,
            configMetadata,
        });
    });

    it('sets webview options correctly', async () => {
        await provider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );

        expect(webviewPanel.webview.options.enableScripts).toBe(true);
        const roots = webviewPanel.webview.options.localResourceRoots;
        expect(Array.isArray(roots)).toBe(true);
        expect(roots![0].fsPath).toContain(
            path.join(context.extensionPath, 'dist'),
        );
    });

    it('handles successful deploy and posts deploy-complete', async () => {
        jest.mocked(vscode.window.withProgress).mockImplementation(
            async (_opts, cb) => {
                const token: vscode.CancellationToken = {
                    onCancellationRequested: cancellationEventEmitter.event,
                    isCancellationRequested: false,
                };
                await cb(
                    {
                        report: jest.fn(),
                    },
                    token,
                );
            },
        );
        await provider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );

        onDidReceiveMessageEmitter.fire({ type: 'deploy' });
        await waitImmediate();
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles unsuccessful deploy and posts deploy-complete', async () => {
        await provider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );
        const error = new Error('deploy-fail');
        deploy.deploy.mockRejectedValueOnce(error);

        onDidReceiveMessageEmitter.fire({ type: 'deploy' });
        await waitImmediate();

        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
        expect(logger.error).toHaveBeenCalledWith(
            'Error during deployment',
            error,
        );
        expect(
            jest.mocked(vscode.window.showErrorMessage),
        ).toHaveBeenCalledWith('Error during deployment: deploy-fail');
    });

    it('warns on unknown message type', async () => {
        await provider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );

        onDidReceiveMessageEmitter.fire({ type: 'not-a-real-type' });

        expect(showAndLogError).toHaveBeenCalledWith(
            'Unexpected error handling message from compose editor webview',
            new Error(
                'Invalid webview message: unknown type "not-a-real-type"',
            ),
        );
    });
});
