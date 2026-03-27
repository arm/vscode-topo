import fs from 'fs';
import { TopoCli } from '../topoCli';
import { getTargetDescription } from '../util/getTargetDescription';
import { TargetDescriptionStore } from './targetDescriptionStore';
import { mock } from 'jest-mock-extended';
import { TargetDescription } from '../util/types';

jest.mock('fs');
jest.mock('../util/getTargetDescription');

const mockTmpDir = '/tmp/topo-target-12345';

describe('TargetDescriptionStore', () => {
    const topoCli = mock<TopoCli>();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fs.mkdtempSync).mockReturnValue(mockTmpDir);
    });

    it('should load and parse target description correctly', async () => {
        const targetDescription: TargetDescription = {
            hostProcessor: [
                {
                    model: 'Cortex-A55',
                    cores: 2,
                    features: ['fp', 'asimd', 'evtstrm', 'aes'],
                },
            ],
            remoteprocCPU: [{ name: 'imx-rproc' }],
        };
        jest.mocked(getTargetDescription).mockResolvedValue(targetDescription);
        const store = new TargetDescriptionStore(topoCli);

        const description = await store.getDescription('user@host');

        expect(description).toEqual(targetDescription);
    });

    it('should only allow each target description to be fetched once', async () => {
        const store = new TargetDescriptionStore(topoCli);

        await Promise.all([
            store.getDescription('user@host'),
            store.getDescription('user@host2'),
            store.getDescription('user@host'),
            store.getDescription('user@host2'),
        ]);

        expect(getTargetDescription).toHaveBeenCalledTimes(2);
    });
});
