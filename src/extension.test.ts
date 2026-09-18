import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { activate } from './extension';
import { TOPO_TASK_TYPE } from './manifest';
import { TopoCli } from './services/topoCli';
import { Config } from './services/config';
import { Telemetry } from './services/telemetry';
import { logger } from './util/logger';

vi.mock('child_process');
vi.mock('./util/logger');
vi.mock('./services/topoCli');
vi.mock('./services/telemetry', () => ({ Telemetry: vi.fn() }));

function createContext(
    extensionMode = vscode.ExtensionMode.Production,
): vscode.ExtensionContext {
    return mock<vscode.ExtensionContext>({
        extensionMode,
        subscriptions: [],
        globalState: mock<vscode.Memento>(),
        workspaceState: mock<vscode.Memento>(),
        extensionUri: vscode.Uri.file('/fake/extension'),
    });
}

describe('extension activation', () => {
    const telemetry = mock<Telemetry>();

    beforeEach(() => {
        vi.mocked(Telemetry).mockImplementation(function () {
            return telemetry;
        });
        telemetry.trackActivation.mockImplementation((activate) => activate());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it('registers commands, tasks, and prepares disposables', async () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        const context = createContext(vscode.ExtensionMode.Development);

        await activate(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(
            vscode.tasks.registerTaskProvider,
        ).toHaveBeenCalledExactlyOnceWith(TOPO_TASK_TYPE, expect.any(Object));
        expect(Telemetry).toHaveBeenCalledWith(
            expect.any(Config),
            vscode.ExtensionMode.Development,
        );
        expect(context.subscriptions).toContain(telemetry);
        expect(telemetry.trackActivation).toHaveBeenCalledOnce();
        expect(setTimeoutSpy).toHaveBeenCalledWith(
            expect.any(Function),
            60_000,
        );
    });

    it('propagates activation failures', async () => {
        const error = new Error('Activation failed');
        const topoCli = mock<TopoCli>({
            activate: vi.fn(() => {
                throw error;
            }),
        });
        vi.mocked(TopoCli).mockImplementation(function () {
            return topoCli;
        });
        const context = createContext();

        await expect(activate(context)).rejects.toBe(error);
    });

    it('shows an error and skips command registration when the topo CLI version check fails', async () => {
        const topoCli = mock<TopoCli>({
            assertVersion: vi
                .fn()
                .mockRejectedValue(new Error('version mismatch')),
        });
        vi.mocked(TopoCli).mockImplementation(function () {
            return topoCli;
        });
        const context = createContext();

        await activate(context);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('version mismatch'),
        );
        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
        expect(context.subscriptions).toContain(logger);
        expect(topoCli.activate).toHaveBeenCalledOnce();
    });
});
