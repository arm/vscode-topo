import { WrappedError } from '../errors/wrappedError';

const supportedSshDestinationCharacters = /^[A-Za-z0-9._~@:%+\-[\]]+$/;

export function assertValidSshDestination(destination: string): void {
    if (
        destination.startsWith('-') ||
        !supportedSshDestinationCharacters.test(destination)
    ) {
        const message = `Invalid SSH destination: ${destination}`;
        throw new WrappedError('INVALID_SSH_DESTINATION', message, [
            { level: 'Error', msg: message },
        ]);
    }
}
