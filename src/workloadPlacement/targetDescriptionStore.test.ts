import fs from 'fs';
import { TopoCli } from '../topoCli';
import { getTargetDescription } from '../util/getTargetDescription';
import { TargetDescriptionStore } from './targetDescriptionStore';
import { mock } from 'jest-mock-extended';
import { TargetDescription, TargetItem } from '../util/types';

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

        const description = await store.getDescription({
            id: 'test',
            ssh: 'user@host',
            host: 'host',
        });

        expect(description).toEqual(targetDescription);
    });

    it('should only allow each target description to be fetched once', async () => {
        const store = new TargetDescriptionStore(topoCli);
        const target: TargetItem = {
            id: 'test',
            ssh: 'user@host',
            host: 'host',
        };
        const target2: TargetItem = {
            id: 'test2',
            ssh: 'user@host2',
            host: 'host2',
        };

        await Promise.all([
            store.getDescription(target),
            store.getDescription(target2),
            store.getDescription(target),
            store.getDescription(target2),
        ]);

        expect(getTargetDescription).toHaveBeenCalledTimes(2);
    });
});
