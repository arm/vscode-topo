import { TelemetryReporter } from '@vscode/extension-telemetry';
import { mock } from 'vitest-mock-extended';
import { Telemetry } from './telemetry';

vi.mock('@vscode/extension-telemetry', () => ({ TelemetryReporter: vi.fn() }));
vi.mock('../util/logger');

describe('Telemetry', () => {
    const reporter = mock<TelemetryReporter>();
    const connectionString = 'test-connection-string';

    beforeEach(() => {
        vi.stubGlobal('__TELEMETRY_CONNECTION_STRING__', connectionString);
        vi.mocked(TelemetryReporter).mockImplementation(function () {
            return reporter;
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetAllMocks();
    });

    it('tracks activation and disposes the configured reporter', async () => {
        const telemetry = new Telemetry();

        expect(TelemetryReporter).toHaveBeenCalledWith(connectionString);

        const result = await telemetry.trackActivation(
            async () => 'extension API',
        );

        expect(result).toBe('extension API');
        expect(reporter.sendTelemetryEvent).toHaveBeenCalledWith(
            'activated',
            {},
            expect.any(Object),
        );
        await telemetry.dispose();
        expect(reporter.dispose).toHaveBeenCalledOnce();
    });

    it('runs activation without a reporter when built without a connection string', async () => {
        vi.stubGlobal('__TELEMETRY_CONNECTION_STRING__', '');
        const telemetry = new Telemetry();

        await expect(
            telemetry.trackActivation(async () => 'extension API'),
        ).resolves.toBe('extension API');
        expect(TelemetryReporter).not.toHaveBeenCalled();
        await telemetry.dispose();
    });

    it('preserves activation errors when reporter initialization fails', async () => {
        vi.mocked(TelemetryReporter).mockImplementation(function () {
            throw new Error('Reporter unavailable');
        });
        const telemetry = new Telemetry();
        const error = new Error('Activation failed');

        await expect(
            telemetry.trackActivation(async () => {
                throw error;
            }),
        ).rejects.toBe(error);
        await telemetry.dispose();
    });
});
