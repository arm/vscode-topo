import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { activate } from './extension';
import { TopoCli } from './services/topoCli';
import { logger } from './util/logger';

vi.mock('child_process');
vi.mock('./util/logger');
vi.mock('./services/topoCli');

describe('extension activation', () => {
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it('registers commands and prepares disposables', async () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        const context = mock<vscode.ExtensionContext>({
            subscriptions: [],
            globalState: mock<vscode.Memento>(),
            workspaceState: mock<vscode.Memento>(),
        });

        await activate(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(context.subscriptions.length).toBeGreaterThan(0);
        expect(setTimeoutSpy).toHaveBeenCalledWith(
            expect.any(Function),
            60_000,
        );
    });

    it('shows an error and skips command registration when the topo CLI version check fails', async () => {
        vi.mocked(TopoCli).mockImplementation(function () {
            return mock<TopoCli>({
                assertVersion: vi.fn().mockImplementation(() => {
                    throw new Error('version mismatch');
                }),
            });
        });
        const context = mock<vscode.ExtensionContext>({
            subscriptions: [],
        });

        await activate(context);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('version mismatch'),
        );
        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
        expect(context.subscriptions).toContain(logger);
    });
});
