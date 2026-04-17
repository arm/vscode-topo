import { TopoCli } from '../topoCli';
import { TargetDescription } from './types';
import { parseTargetDescription } from './parseTargetDescription';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger } from './logger';

export async function getTargetDescription(
    cli: TopoCli,
    ssh: string,
): Promise<TargetDescription | undefined> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'topo-target-'));
    try {
        const descriptionPath = await cli.describe(tmpDir, ssh);
        const yaml = fs.readFileSync(descriptionPath, 'utf8');
        return parseTargetDescription(yaml);
    } catch (error) {
        logger.warn(`Failed to get target description for ${ssh}`, error);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    return undefined;
}
