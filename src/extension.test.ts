import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
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
        const environmentVariableCollection =
            mock<vscode.EnvironmentVariableCollection>();
        const globalState = mock<vscode.Memento>();
        const workspaceState = mock<vscode.Memento>();
        const globalStorageUri = vscode.Uri.file('/fake/storage/path');
        const context = mock<vscode.ExtensionContext>({
            subscriptions,
            extensionPath,
            environmentVariableCollection,
            globalState,
            workspaceState,
            globalStorageUri,
        });

        await activate(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(subscriptions.length).toBeGreaterThan(0);
    });
});
