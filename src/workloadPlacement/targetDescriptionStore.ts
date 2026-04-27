import { TopoCli } from '../topoCli';
import { TargetDescription } from '../util/types';

import { Deferred } from '../util/deferred';
import { getTargetDescription } from '../util/getTargetDescription';

export class TargetDescriptionStore {
    private cache = new Map<string, Deferred<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

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
            const description = await getTargetDescription(
                this.topoCli,
                target,
            );
            deferred.resolve(description);
        })();

        return deferred.promise;
    }
}
