import { TopoCli } from '../topoCli';
import { TargetDescription, TargetItem } from '../util/types';

import { Deferred } from '../util/deferred';
import { getTargetDescription } from '../util/getTargetDescription';

export class TargetDescriptionStore {
    private cache = new Map<string, Deferred<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

    public async getDescription(
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
