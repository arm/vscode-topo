import { TopoCli } from '../topoCli';
import { TargetDescription } from '../util/types';

import { Deferred } from '../util/deferred';
import { logger } from '../util/logger';

export class TargetDescriptionStore {
    private cache = new Map<string, Deferred<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

    private async loadDescription(
        target: string,
    ): Promise<TargetDescription | undefined> {
        try {
            return await this.topoCli.describe(target);
        } catch (error) {
            logger.warn(
                `Failed to get target description for ${target}`,
                error,
            );
            return undefined;
        }
    }

    public async getDescription(
        target: string,
    ): Promise<TargetDescription | undefined> {
        const existing = this.cache.get(target);
        if (existing) {
            return existing.promise;
        }

        const deferred = new Deferred<TargetDescription | undefined>();
        this.cache.set(target, deferred);
        (async () => {
            const description = await this.loadDescription(target);
            deferred.resolve(description);
        })();

        return deferred.promise;
    }
}
