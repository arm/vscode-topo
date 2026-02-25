import { Target } from './target';

const yamlTargetDescription = `host:
    - model: Cortex-A55
      cores: 2
      features:
        - fp
        - asimd
        - evtstrm
        - aes
remoteprocs:
    - name: imx-rproc`;

const targetDescription = {
    hostProcessor: [
        {
            model: 'Cortex-A55',
            cores: 2,
            features: ['fp', 'asimd', 'evtstrm', 'aes'],
        },
    ],
    remoteprocCPU: [
        {
            name: 'imx-rproc',
        },
    ],
};

describe('Target', () => {
    it('parses user and host from user@host', () => {
        const t = new Target('id1', 'alice@example.com', yamlTargetDescription);
        expect(t.user).toBe('alice');
        expect(t.host).toBe('example.com');
    });

    it('handles host-only ssh (no user)', () => {
        const t = new Target('id2', 'example.com', yamlTargetDescription);
        expect(t.user).toBeUndefined();
        expect(t.host).toBe('example.com');
    });

    it('accepts values with surrounding whitespace and parses from trimmed ssh', () => {
        const t = new Target(
            ' id3 ',
            '  bob@host.com  ',
            yamlTargetDescription,
        );
        expect(t.id).toBe('id3');
        expect(t.ssh).toBe('bob@host.com');
        expect(t.user).toBe('bob');
        expect(t.host).toBe('host.com');
        expect(t.targetDescription).toEqual(targetDescription);
    });

    it('returns stored id, ssh and targetDescription via toJSON', () => {
        const t = new Target('id4', 'carol@domain', yamlTargetDescription);
        const json = t.toJSON();
        expect(json).toEqual({
            id: 'id4',
            ssh: 'carol@domain',
            targetDescription: yamlTargetDescription,
        });
    });

    it('throws for empty id or ssh in constructor', () => {
        expect(() => new Target('', 'host', yamlTargetDescription)).toThrow(
            /Target id must be a non-empty string/,
        );
        expect(() => new Target('id', '', yamlTargetDescription)).toThrow(
            /Target ssh must be a non-empty string/,
        );
    });

    it('throws when ssh contains user but missing host', () => {
        expect(() => new Target('id5', 'user@', yamlTargetDescription)).toThrow(
            /missing host in SSH target/,
        );
    });

    it('returns the same instance when passed to static from', () => {
        const original = new Target('id6', 'dave@abc', yamlTargetDescription);
        const result = Target.from(original);
        expect(result).toBe(original);
    });

    it('recreates Target from plain object and validates inputs', () => {
        const obj = {
            id: 'id7',
            ssh: 'eva@xyz',
            name: 'label',
            targetDescription: yamlTargetDescription,
        };
        const t = Target.from(obj);
        expect(t).toBeInstanceOf(Target);
        expect(t.id).toBe('id7');
        expect(t.ssh).toBe('eva@xyz');
        expect(t.targetDescription).toEqual(targetDescription);
        expect(t.user).toBe('eva');
        expect(t.host).toBe('xyz');
    });

    it('throws for invalid stored objects in static from', () => {
        expect(() => Target.from({})).toThrow(
            /Invalid stored target: expected property "id" of type string/,
        );
        expect(() => Target.from({ id: 'x' })).toThrow(
            /Invalid stored target: expected property "ssh" of type string/,
        );
        expect(() =>
            Target.from({
                id: 'x',
                ssh: 'user@host',
                targetDescription: 123,
            }),
        ).toThrow(
            /Invalid stored target: expected property "targetDescription" of type undefined or string/,
        );
    });
});
