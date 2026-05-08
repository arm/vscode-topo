import { TopoCli } from '../topoCli';
import { TargetDescription } from '../util/types';
import { logger } from '../util/logger';

export class TargetDescriptionStore {
    private cache = new Map<string, Promise<TargetDescription | undefined>>();

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
        if (!this.cache.has(target)) {
            this.cache.set(target, this.loadDescription(target));
        }

        return this.cache.get(target)!;
    }
}
