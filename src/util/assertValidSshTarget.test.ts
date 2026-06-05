import { WrappedError } from '../errors/wrappedError';
import { assertValidSshTarget } from './assertValidSshTarget';

describe('assertValidSshTarget', () => {
    it.each([
        'user@example.com',
        'topo.local',
        'root@192.168.1.1',
        '[fe80::1%eth0]',
        'ssh://user@example.com',
        'board+debug',
        'prod=west',
        'user@example.com;alias',
    ])('accepts valid target "%s"', (target) => {
        expect(() => assertValidSshTarget(target)).not.toThrow();
    });

    it.each([
        '',
        '-V',
        '-oProxyCommand=touch /tmp/pwned',
        'user@example.com another',
        ' user@example.com',
        'user@example.com ',
        'user@example.com\nother',
    ])(
        'throws an INVALID_TARGET WrappedError for invalid target "%s"',
        (target) => {
            let thrown: unknown;

            try {
                assertValidSshTarget(target);
            } catch (err) {
                thrown = err;
            }

            const message = `Invalid SSH target: ${target}`;
            expect(thrown).toBeInstanceOf(WrappedError);
            expect((thrown as WrappedError).code).toBe('INVALID_TARGET');
            expect((thrown as WrappedError).message).toBe(message);
            expect((thrown as WrappedError).logs).toEqual([
                { level: 'Error', msg: message },
            ]);
        },
    );
});
