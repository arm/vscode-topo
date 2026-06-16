import { WrappedError } from '../errors/wrappedError';
import { assertValidSshDestination } from './assertValidSshDestination';

describe('assertValidSshDestination', () => {
    it.each([
        'user@example.com',
        'topo.local',
        'root@192.168.1.1',
        '[fe80::1%eth0]',
        'board+debug',
    ])('accepts valid SSH destination "%s"', (sshDestination) => {
        expect(() => assertValidSshDestination(sshDestination)).not.toThrow();
    });

    it.each([
        '',
        '-V',
        '-oProxyCommand=touch /tmp/pwned',
        'user@example.com another',
        ' user@example.com',
        'user@example.com ',
        'user@example.com\nother',
        'ssh://user@example.com',
        'prod=west',
        'user@example.com;alias',
    ])(
        'throws an INVALID_SSH_DESTINATION WrappedError for invalid SSH destination "%s"',
        (sshDestination) => {
            const expectedMsg = `Invalid SSH destination: ${sshDestination}`;
            const expectedError = new WrappedError(
                'INVALID_SSH_DESTINATION',
                expectedMsg,
                [{ level: 'Error', msg: expectedMsg }],
            );

            expect(() => assertValidSshDestination(sshDestination)).toThrow(
                expectedError,
            );
        },
    );
});
