import { TopoCli } from '../topoCli';
import { TargetDescription } from '../util/types';
import { getTargetDescription } from '../util/getTargetDescription';

export class TargetDescriptionStore {
    private cache = new Map<string, Promise<TargetDescription | undefined>>();

    constructor(private topoCli: TopoCli) {}

    public async getDescription(
        target: string,
    ): Promise<TargetDescription | undefined> {
        if (!this.cache.has(target)) {
            const descriptionPromise = getTargetDescription(
                this.topoCli,
                target,
            );
            this.cache.set(target, descriptionPromise);
        }

        return this.cache.get(target)!;
    }
}
