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
            hostProcessors: description.host.map((processor) => ({
                model: processor.model,
                cores: processor.cores,
                features: processor.features,
            })),
            remoteprocCpus: description.remoteprocs.map((remoteproc) => ({
                name: remoteproc.name,
            })),
        };
    } catch (error) {
        logger.warn(`Failed to get target description for ${ssh}`, error);
    }

    return undefined;
}
