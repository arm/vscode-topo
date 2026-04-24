import * as vscode from 'vscode';
import * as path from 'node:path';
import { ComposeEditorProvider } from './composeEditorProvider';
import { ComposeEditorMessageHandler } from './composeEditorMessageHandler';
import { Deploy } from './actions/deploy';
import { logger } from './util/logger';
import { showAndLogError } from './util/showAndLogError';
import { TopoCli } from './topoCli';
import { mock, MockProxy } from 'jest-mock-extended';
import { ProjectDescription } from './topoCliSchema';
import { TargetStore } from './workloadPlacement/targetStore';
import { TargetDescription, TargetItem } from './util/types';
import { TargetDescriptionStore } from './workloadPlacement/targetDescriptionStore';

jest.mock('./util/logger');
jest.mock('./util/showAndLogError', () => ({
    showAndLogError: jest.fn(),
}));

const waitImmediate = () =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

describe('ComposeEditorProvider', () => {
    const target: TargetItem = {
        ssh: 'user@topo.local',
    };
    const targetDescription: TargetDescription = {
        hostProcessor: [],
        remoteprocCPU: [{ name: 'imx-rproc' }],
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
    const context = mock<vscode.ExtensionContext>({
        extensionUri: vscode.Uri.file('/ext'),
        extensionPath: '/ext',
        subscriptions: [],
    });
    let post: (arg: unknown) => Thenable<boolean>;
    let onDidReceiveMessageEmitter: vscode.EventEmitter<unknown>;
    let webviewPanel: vscode.WebviewPanel;
    let topoCli: MockProxy<TopoCli>;
    let deploy: MockProxy<Deploy>;
    let targetStore: MockProxy<TargetStore>;
    let targetDescriptionStore: MockProxy<TargetDescriptionStore>;
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
        topoCli = mock<TopoCli>();
        topoCli.getProject.mockReturnValue(project);
        deploy = mock<Deploy>();
        targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(target);
        targetDescriptionStore = mock<TargetDescriptionStore>();
        targetDescriptionStore.getDescription.mockResolvedValue(
            targetDescription,
        );
        composeEditorMessageHandler = new ComposeEditorMessageHandler(
            topoCli,
            deploy,
            targetStore,
            targetDescriptionStore,
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
            composeEditorProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            },
        );
    });

    it('posts init message with services', async () => {
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
        );
        await composeEditorProvider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );

        onDidReceiveMessageEmitter.fire({
            type: 'compose-editor-webview-ready',
        });

        await waitImmediate();

        expect(post).toHaveBeenCalledWith({
            type: 'render-compose-editor',
            project,
            subsystems: ['Host', 'imx-rproc'],
        });
    });

    it('sets webview options correctly', async () => {
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
        );
        await composeEditorProvider.resolveCustomTextEditor(
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
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
        );
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
        await composeEditorProvider.resolveCustomTextEditor(
            doc,
            webviewPanel,
            cancellationToken,
        );

        onDidReceiveMessageEmitter.fire({ type: 'deploy' });
        await waitImmediate();
        expect(post).toHaveBeenCalledWith({ type: 'deploy-complete' });
    });

    it('handles unsuccessful deploy and posts deploy-complete', async () => {
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
        );
        await composeEditorProvider.resolveCustomTextEditor(
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
        const composeEditorProvider = new ComposeEditorProvider(
            context,
            composeEditorMessageHandler,
        );
        await composeEditorProvider.resolveCustomTextEditor(
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
