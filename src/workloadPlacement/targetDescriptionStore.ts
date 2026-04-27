import { TopoCli } from '../topoCli';
import { TargetDescription } from '../util/types';

import { Deferred } from '../util/deferred';
import { logger } from '../util/logger';

export class TargetDescriptionStore {
    private cache = new Map<string, Deferred<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

    private async loadDescription(
        targetSsh: string,
    ): Promise<TargetDescription | undefined> {
        try {
            return await this.topoCli.describe(targetSsh);
        } catch (error) {
            logger.warn(
                `Failed to get target description for ${targetSsh}`,
                error,
            );
            return undefined;
        }
    }

    public async getDescription(
        targetSsh: string,
    ): Promise<TargetDescription | undefined> {
        const existing = this.cache.get(targetSsh);
        if (existing) {
            return existing.promise;
        }

        const deferred = new Deferred<TargetDescription | undefined>();
        this.cache.set(targetSsh, deferred);
        (async () => {
            const description = await this.loadDescription(targetSsh);
            deferred.resolve(description);
        })();

        return deferred.promise;
    }
}
