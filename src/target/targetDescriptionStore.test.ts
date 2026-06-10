import { TopoCli } from '../topoCli';
import { TargetDescriptionStore } from './targetDescriptionStore';
import { mock } from 'vitest-mock-extended';
import { TargetDescription } from '../util/types';
import { logger } from '../util/logger';

vi.mock('../util/logger');

describe('TargetDescriptionStore', () => {
    const topoCli = mock<TopoCli>();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should load and parse target description correctly', async () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [
                {
                    model: 'Cortex-A55',
                    cores: 2,
                    features: ['fp', 'asimd', 'evtstrm', 'aes'],
                },
            ],
            remoteProcessors: [{ name: 'imx-rproc' }],
            totalMemoryKb: 1024,
        };
        topoCli.describe.mockResolvedValue(targetDescription);
        const store = new TargetDescriptionStore(topoCli);

        const description = await store.getDescription('user@host');

        expect(description).toEqual(targetDescription);
    });

    it('should only allow each target description to be fetched once', async () => {
        topoCli.describe.mockResolvedValue({
            hostProcessors: [],
            remoteProcessors: [],
            totalMemoryKb: 1024,
        });
        const store = new TargetDescriptionStore(topoCli);

        await Promise.all([
            store.getDescription('user@host'),
            store.getDescription('user@host2'),
            store.getDescription('user@host'),
            store.getDescription('user@host2'),
        ]);

        expect(topoCli.describe).toHaveBeenCalledTimes(2);
    });

    it('should log a warning and return undefined when describe fails', async () => {
        const error = new Error('invalid json');
        topoCli.describe.mockRejectedValue(error);
        const store = new TargetDescriptionStore(topoCli);

        const description = await store.getDescription('user@host');

        expect(description).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(
            'Failed to get target description for user@host',
            error,
        );
    });
});
