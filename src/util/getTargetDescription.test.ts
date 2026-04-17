import fs from 'node:fs';
import { mock } from 'jest-mock-extended';
import { TopoCli } from '../topoCli';
import { logger } from './logger';
import { parseTargetDescription } from './parseTargetDescription';
import { getTargetDescription } from './getTargetDescription';
import type { TargetDescription } from './types';

jest.mock('node:fs');
jest.mock('./logger');
jest.mock('./parseTargetDescription');

describe('getTargetDescription', () => {
    const topoCli = mock<TopoCli>();
    const tmpDir = '/tmp/topo-target-12345';
    const descriptionPath = '/tmp/topo-target-12345/target-description.yaml';

    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(fs.mkdtempSync).mockReturnValue(tmpDir);
    });

    it('returns the parsed target description from topo describe output', async () => {
        const yaml = ['host: []', 'remoteprocs: []'].join('\n');
        const targetDescription: TargetDescription = {
            hostProcessor: [],
            remoteprocCPU: [],
        };
        topoCli.describe.mockResolvedValue(descriptionPath);
        jest.mocked(fs.readFileSync).mockReturnValue(yaml);
        jest.mocked(parseTargetDescription).mockReturnValue(targetDescription);

        const result = await getTargetDescription(topoCli, 'user@target');

        expect(result).toEqual(targetDescription);
        expect(topoCli.describe).toHaveBeenCalledWith(tmpDir, 'user@target');
        expect(fs.readFileSync).toHaveBeenCalledWith(descriptionPath, 'utf8');
        expect(parseTargetDescription).toHaveBeenCalledWith(yaml);
        expect(fs.rmSync).toHaveBeenCalledWith(tmpDir, {
            recursive: true,
            force: true,
        });
    });

    it('logs a warning, returns undefined, and removes the temp directory when parsing fails', async () => {
        const error = new Error('invalid yaml');
        topoCli.describe.mockResolvedValue(descriptionPath);
        jest.mocked(fs.readFileSync).mockReturnValue('host: [');
        jest.mocked(parseTargetDescription).mockImplementation(() => {
            throw error;
        });

        const result = await getTargetDescription(topoCli, 'user@target');

        expect(result).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(
            'Failed to get target description for user@target',
            error,
        );
        expect(fs.rmSync).toHaveBeenCalledWith(tmpDir, {
            recursive: true,
            force: true,
        });
    });
});
