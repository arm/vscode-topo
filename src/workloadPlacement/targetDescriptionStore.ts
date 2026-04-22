import { TopoCli } from '../topoCli';
import { TargetDescription } from '../util/types';

import { getTargetDescription } from '../util/getTargetDescription';

export class TargetDescriptionStore {
    private cache = new Map<string, Promise<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

    public async getDescription(
        targetSsh: string,
    ): Promise<TargetDescription | undefined> {
        const existing = this.cache.get(targetSsh);
        if (existing) {
            return existing;
        }

        const promise = getTargetDescription(this.topoCli, targetSsh);
        this.cache.set(targetSsh, promise);
        return promise;
    }
}
