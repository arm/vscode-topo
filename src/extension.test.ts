import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import { activate } from './extension';

jest.mock('child_process');
jest.mock('./util/logger');
jest.mock('./topoCli');
jest.mock('./topoCliVersionChecker', () => {
    return {
        TopoCliVersionChecker: jest.fn().mockImplementation(() => ({
            checkTopoCliVersion: jest.fn(() => true),
        })),
    };
});

describe('extension activation', () => {
    let subscriptions: vscode.Disposable[];

    beforeEach(() => {
        jest.useFakeTimers();
        subscriptions = [];
    });

    afterEach(() => {
        for (const sub of subscriptions) {
            sub.dispose();
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.resetAllMocks();
    });

    it('registers commands and prepares disposables', async () => {
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
