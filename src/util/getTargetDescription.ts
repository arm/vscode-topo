import { TopoCli } from '../topoCli';
import { TargetDescription } from './types';
import { logger } from './logger';

export async function getTargetDescription(
    cli: TopoCli,
    ssh: string,
): Promise<TargetDescription | undefined> {
    try {
        const description = await cli.describe(ssh);
        return {
            hostProcessors: description.host,
            remoteprocCpus: description.remoteprocs,
        }
    } catch (error) {
        logger.warn(`Failed to get target description for ${ssh}`, error);
    }

    return undefined;
}
