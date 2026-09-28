import * as vscode from 'vscode';
import { mock } from 'vitest-mock-extended';
import { activate } from './extension';
import { TOPO_TASK_TYPE } from './manifest';
import { TopoCli } from './services/topoCli';
import { Telemetry } from './services/telemetry';
import { TelemetryClient } from './services/telemetryClient';
import { logger } from './util/logger';

vi.mock('child_process');
vi.mock('./util/logger');
vi.mock('./services/topoCli');
vi.mock('./services/telemetryClient', () => ({ TelemetryClient: vi.fn() }));

function createContext(): vscode.ExtensionContext {
    return mock<vscode.ExtensionContext>({
        subscriptions: [],
        globalState: mock<vscode.Memento>(),
        workspaceState: mock<vscode.Memento>(),
        extensionUri: vscode.Uri.file('/fake/extension'),
    });
}

describe('extension activation', () => {
    const telemetryClient = mock<TelemetryClient>();
    const connectionString = 'test-connection-string';

    beforeEach(() => {
        vi.stubGlobal('__TELEMETRY_CONNECTION_STRING__', connectionString);
        vi.mocked(TelemetryClient).mockImplementation(function () {
            return telemetryClient;
        });
        telemetryClient.track.mockImplementation((_eventName, operation) =>
            operation(),
        );
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.resetAllMocks();
    });

    it('registers commands, tasks, and prepares disposables', async () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        const context = createContext();

        await activate(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalled();
        expect(
            vscode.tasks.registerTaskProvider,
        ).toHaveBeenCalledExactlyOnceWith(TOPO_TASK_TYPE, expect.any(Object));
        expect(TelemetryClient).toHaveBeenCalledWith(connectionString);
        expect(telemetryClient.track).toHaveBeenCalledOnce();
        expect(context.subscriptions).toContainEqual(expect.any(Telemetry));
        expect(setTimeoutSpy).toHaveBeenCalledWith(
            expect.any(Function),
            60_000,
        );
    });

    it('shows an error and skips command registration when the topo CLI version check fails', async () => {
        vi.stubGlobal('__TELEMETRY_CONNECTION_STRING__', '');
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
        expect(TelemetryClient).not.toHaveBeenCalled();
    });

    it('registers commands when telemetry client initialization fails', async () => {
        vi.useFakeTimers();
        vi.mocked(TelemetryClient).mockImplementation(function () {
            throw new Error('Reporter unavailable');
        });

        await activate(createContext());

        expect(vscode.commands.registerCommand).toHaveBeenCalled();
    });
});
