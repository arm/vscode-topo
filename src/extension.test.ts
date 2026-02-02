import * as vscode from 'vscode';
import { activate } from './extension';

jest.mock('vscode');
jest.mock('./util/logger');
jest.mock('./topoCliVersionChecker', () => {
    return {
        TopoCliVersionChecker: jest.fn().mockImplementation(() => ({
            checkTopoCliVersion: jest.fn(() => Promise.resolve(true)),
        })),
    };
});

describe('extension activation', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(async () => {
        try {
            jest.runOnlyPendingTimers();
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
            jest.resetAllMocks();
        }
    });

    it('registers commands and prepares disposables', async () => {
        const subscriptions: vscode.Disposable[] = [];
        const extensionPath = '/fake/extension/path';
        const environmentVariableCollection = {
            prepend: jest.fn(),
        };
        const globalState = {
            get: jest.fn(),
        };
        const workspaceState = {
            get: jest.fn(),
        };
        const globalStorageUri = vscode.Uri.file('/fake/storage/path');
        const context = {
            subscriptions,
            extensionPath,
            environmentVariableCollection,
            globalState,
            workspaceState,
            globalStorageUri,
        } as unknown as vscode.ExtensionContext;
        jest.mocked(vscode.commands.registerCommand).mockImplementation(() => ({
            dispose: jest.fn(),
        }));

        await activate(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(subscriptions.length).toBeGreaterThan(0);
    });
});
