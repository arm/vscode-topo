import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { activate } from './extension';

vi.mock('child_process');
vi.mock('./util/logger');
vi.mock('./topoCli');
vi.mock('./topoCliVersionChecker', () => {
    return {
        TopoCliVersionChecker: vi.fn().mockImplementation(function () {
            return {
                checkTopoCliVersion: vi.fn(() => true),
            };
        }),
    };
});

describe('extension activation', () => {
    let subscriptions: vscode.Disposable[];

    beforeEach(() => {
        vi.useFakeTimers();
        subscriptions = [];
    });

    afterEach(() => {
        for (const sub of subscriptions) {
            sub.dispose();
        }
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
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
