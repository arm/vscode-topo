import { WrappedError } from '../errors/wrappedError';
import { type Result, success } from './result';

const supportedSshDestinationCharacters = /^[A-Za-z0-9._~@:%+\-[\]]+$/;

export function validateSshDestination(destination: string): Result<void> {
    if (
        destination.startsWith('-') ||
        !supportedSshDestinationCharacters.test(destination)
    ) {
        const message = `Invalid SSH destination: ${destination}`;
        return new WrappedError('INVALID_SSH_DESTINATION', message, [
            { level: 'ERROR', msg: message },
        ]);
    }
    return success();
}
