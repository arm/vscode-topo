import { mock } from 'jest-mock-extended';
import { TopoCli } from '../topoCli';
import { logger } from './logger';
import { getTargetDescription } from './getTargetDescription';
import type { TargetDescription } from './types';

jest.mock('./logger');

describe('getTargetDescription', () => {
    const topoCli = mock<TopoCli>();

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('returns the normalized target description from topo describe output', async () => {
        const targetDescription: TargetDescription = {
            hostProcessors: [
                {
                    model: 'Cortex-A55',
                    cores: 2,
                    features: ['fp', 'asimd'],
                },
            ],
            remoteprocCpus: [{ name: 'imx-rproc' }],
        };
        topoCli.describe.mockResolvedValue({
            host: [
                {
                    model: 'Cortex-A55',
                    cores: 2,
                    features: ['fp', 'asimd'],
                },
            ],
            remoteprocs: [{ name: 'imx-rproc' }],
        });

        const result = await getTargetDescription(topoCli, 'user@target');

        expect(result).toEqual(targetDescription);
        expect(topoCli.describe).toHaveBeenCalledWith('user@target');
    });

    it('logs a warning and returns undefined when describe fails', async () => {
        const error = new Error('invalid json');
        topoCli.describe.mockRejectedValue(error);

        const result = await getTargetDescription(topoCli, 'user@target');

        expect(result).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(
            'Failed to get target description for user@target',
            error,
        );
    });
});
