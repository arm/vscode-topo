import { TopoCli } from '../topoCli';
import { TargetDescription, TargetItem } from '../util/types';
import { parseTargetDescription } from '../util/parseTargetDescription';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../util/logger';
import { Deferred } from '../util/deferred';

async function getTargetDescription(
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

export class TargetDescriptionStore {
    private cache = new Map<string, Deferred<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

    public async getTargetDescription(
        target: TargetItem,
    ): Promise<TargetDescription | undefined> {
        const existing = this.cache.get(target.id);
        if (existing) {
            return existing.promise;
        }

        const deferred = new Deferred<TargetDescription | undefined>();
        this.cache.set(target.id, deferred);
        (async () => {
            const description = await getTargetDescription(
                this.topoCli,
                target.ssh,
            );
            deferred.resolve(description);
        })();

        return deferred.promise;
    }
}
