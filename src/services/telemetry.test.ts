import { mock } from 'vitest-mock-extended';
import { Telemetry } from './telemetry';
import type { TelemetryClient } from './telemetryClient';

describe('Telemetry', () => {
    it('tracks activation and disposes the injected client', async () => {
        const client = mock<TelemetryClient>();
        client.track.mockImplementation((_eventName, operation) => operation());
        const telemetry = new Telemetry(client);
        const activate = async () => 'extension API';

        await expect(telemetry.trackActivation(activate)).resolves.toBe(
            'extension API',
        );
        expect(client.track).toHaveBeenCalledExactlyOnceWith(
            'activate',
            activate,
        );
        await telemetry.dispose();
        expect(client.dispose).toHaveBeenCalledOnce();
    });

    it('runs activation without a client', async () => {
        const telemetry = new Telemetry();
        const activate = vi.fn(async () => 'extension API');

        await expect(telemetry.trackActivation(activate)).resolves.toBe(
            'extension API',
        );
        expect(activate).toHaveBeenCalledOnce();
        await telemetry.dispose();
    });
});
