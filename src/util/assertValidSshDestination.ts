import { WrappedError } from '../errors/wrappedError';

const supportedSshTargetCharacters = /^[A-Za-z0-9._~@:%+\-[\]]+$/;

export function assertValidSshDestination(target: string): void {
    if (target.startsWith('-') || !supportedSshTargetCharacters.test(target)) {
        const message = `Invalid SSH target: ${target}`;
        throw new WrappedError('INVALID_SSH_DESTINATION', message, [
            { level: 'Error', msg: message },
        ]);
    }
}
