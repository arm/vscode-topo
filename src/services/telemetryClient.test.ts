import { TelemetryReporter } from '@vscode/extension-telemetry';
import { ExtensionMode } from 'vscode';
import { mock } from 'vitest-mock-extended';
import { TelemetryClient } from './telemetryClient';

vi.mock('../util/logger');
vi.mock('@vscode/extension-telemetry', () => ({ TelemetryReporter: vi.fn() }));

describe('TelemetryClient', () => {
    const reporter = mock<TelemetryReporter>();
    const connectionString = 'test-connection-string';
    let client: TelemetryClient;

    beforeEach(() => {
        vi.mocked(TelemetryReporter).mockImplementation(function () {
            return reporter;
        });
        client = new TelemetryClient(
            connectionString,
            ExtensionMode.Development,
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it('keeps event properties separate from metadata and reports the result and duration in seconds', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(0);
        const properties = {
            activationReason: 'workspaceContains',
            outcome: 'failure',
        };

        const result = await client.track(
            'activate',
            async () => {
                now.mockReturnValue(1500);
                return 'operation result';
            },
            properties,
        );

        expect(result).toBe('operation result');
        expect(TelemetryReporter).toHaveBeenCalledExactlyOnceWith(
            connectionString,
        );
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledExactlyOnceWith(
            'activate',
            {
                'event.activationReason': 'workspaceContains',
                'event.outcome': 'failure',
                'meta.extensionMode': 'development',
                'meta.outcome': 'success',
            },
            { durationSeconds: 1.5 },
        );
        expect(reporter.sendTelemetryErrorEvent).not.toHaveBeenCalled();
        await client.dispose();
        expect(reporter.dispose).toHaveBeenCalledOnce();
    });

    it('keeps event properties separate from failure details and rethrows the original error', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(0);
        const error = new Error('Operation failed');

        await expect(
            client.track(
                'activate',
                async () => {
                    now.mockReturnValue(250);
                    throw error;
                },
                {
                    outcome: 'success',
                    errorMessage: 'event context',
                },
            ),
        ).rejects.toBe(error);

        expect(
            reporter.sendTelemetryErrorEvent,
        ).toHaveBeenCalledExactlyOnceWith(
            'activate',
            {
                'event.outcome': 'success',
                'event.errorMessage': 'event context',
                'meta.extensionMode': 'development',
                'meta.outcome': 'failure',
                'meta.errorMessage': error.message,
                'meta.stack': error.stack,
            },
            { durationSeconds: 0.25 },
        );
        expect(reporter.sendTelemetryEvent).not.toHaveBeenCalled();
    });

    it('preserves failures that are not Error objects', async () => {
        await expect(
            client.track(
                'activate',
                vi.fn().mockRejectedValue('Operation rejected'),
            ),
        ).rejects.toBe('Operation rejected');

        expect(reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
            'activate',
            expect.objectContaining({
                'meta.extensionMode': 'development',
                'meta.outcome': 'failure',
                'meta.errorMessage': 'Operation rejected',
            }),
            expect.any(Object),
        );
    });

    it('preserves a successful result when event reporting fails', async () => {
        reporter.sendTelemetryEvent.mockImplementation(() => {
            throw new Error('Reporter unavailable');
        });

        await expect(
            client.track('activate', async () => 'operation result'),
        ).resolves.toBe('operation result');
    });

    it('preserves the operation error when reporting that error fails', async () => {
        const error = new Error('Operation failed');
        reporter.sendTelemetryErrorEvent.mockImplementation(() => {
            throw new Error('Reporter unavailable');
        });

        await expect(
            client.track('activate', async () => {
                throw error;
            }),
        ).rejects.toBe(error);
    });
});
