import type { TelemetryReporter } from '@vscode/extension-telemetry';
import { mock } from 'vitest-mock-extended';
import { TelemetryClient } from './telemetryClient';

vi.mock('../util/logger');

describe('TelemetryClient', () => {
    const reporter = mock<TelemetryReporter>();
    let client: TelemetryClient;

    beforeEach(() => {
        client = new TelemetryClient(reporter);
    });

    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it('preserves the operation result and reports its properties and duration in seconds', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(0);
        const properties = { forceRecreate: 'true' };

        const result = await client.track(
            'deployed',
            async () => {
                now.mockReturnValue(1500);
                return 'operation result';
            },
            properties,
        );

        expect(result).toBe('operation result');
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledExactlyOnceWith(
            'deployed',
            properties,
            { durationSeconds: 1.5 },
        );
        expect(reporter.sendTelemetryErrorEvent).not.toHaveBeenCalled();
    });

    it('includes custom properties without overriding failure details and rethrows the original error', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(0);
        const error = new Error('Operation failed');

        await expect(
            client.track(
                'deployed',
                async () => {
                    now.mockReturnValue(250);
                    throw error;
                },
                {
                    forceRecreate: 'true',
                    failedEvent: 'ignored',
                },
            ),
        ).rejects.toBe(error);

        expect(
            reporter.sendTelemetryErrorEvent,
        ).toHaveBeenCalledExactlyOnceWith(
            'exception',
            {
                forceRecreate: 'true',
                failedEvent: 'deployed',
                errorMessage: error.message,
                stack: error.stack,
            },
            { durationSeconds: 0.25 },
        );
        expect(reporter.sendTelemetryEvent).not.toHaveBeenCalled();
    });

    it('preserves failures that are not Error objects', async () => {
        await expect(
            client.track(
                'deployed',
                vi.fn().mockRejectedValue('Operation rejected'),
            ),
        ).rejects.toBe('Operation rejected');

        expect(reporter.sendTelemetryErrorEvent).toHaveBeenCalledWith(
            'exception',
            expect.objectContaining({
                errorMessage: 'Operation rejected',
            }),
            expect.any(Object),
        );
    });

    it('preserves a successful result when event reporting fails', async () => {
        reporter.sendTelemetryEvent.mockImplementation(() => {
            throw new Error('Reporter unavailable');
        });

        await expect(
            client.track('deployed', async () => 'operation result'),
        ).resolves.toBe('operation result');
    });

    it('preserves the operation error when reporting that error fails', async () => {
        const error = new Error('Operation failed');
        reporter.sendTelemetryErrorEvent.mockImplementation(() => {
            throw new Error('Reporter unavailable');
        });

        await expect(
            client.track('deployed', async () => {
                throw error;
            }),
        ).rejects.toBe(error);
    });
});
