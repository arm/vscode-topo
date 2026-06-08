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
            let thrown: unknown;

            try {
                assertValidSshDestination(sshDestination);
            } catch (err) {
                thrown = err;
            }

            const message = `Invalid SSH destination: ${sshDestination}`;
            expect(thrown).toBeInstanceOf(WrappedError);
            expect((thrown as WrappedError).code).toBe(
                'INVALID_SSH_DESTINATION',
            );
            expect((thrown as WrappedError).message).toBe(message);
            expect((thrown as WrappedError).logs).toEqual([
                { level: 'Error', msg: message },
            ]);
        },
    );
});
