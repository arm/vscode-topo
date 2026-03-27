import { Target } from './target';

describe('Target', () => {
    it('parses user and host from user@host', () => {
        const t = new Target('alice@example.com');
        expect(t.user).toBe('alice');
        expect(t.host).toBe('example.com');
    });

    it('handles host-only ssh (no user)', () => {
        const t = new Target('example.com');
        expect(t.user).toBeUndefined();
        expect(t.host).toBe('example.com');
    });

    it('accepts values with surrounding whitespace and parses from trimmed ssh', () => {
        const t = new Target('  bob@host.com  ');
        expect(t.ssh).toBe('bob@host.com');
        expect(t.user).toBe('bob');
        expect(t.host).toBe('host.com');
    });

    it('returns stored ssh via toJSON', () => {
        const t = new Target('carol@domain');
        const json = t.toJSON();
        expect(json).toEqual({
            ssh: 'carol@domain',
        });
    });

    it('throws for empty ssh in constructor', () => {
        expect(() => new Target('')).toThrow(
            /Target ssh must be a non-empty string/,
        );
    });

    it('throws when ssh contains user but missing host', () => {
        expect(() => new Target('user@')).toThrow(/missing host in SSH target/);
    });

    it('returns the same instance when passed to static from', () => {
        const original = new Target('dave@abc');
        const result = Target.from(original);
        expect(result).toBe(original);
    });

    it('recreates Target from plain object and validates inputs', () => {
        const obj = {
            id: 'id7',
            ssh: 'eva@xyz',
            name: 'label',
        };
        const t = Target.from(obj);
        expect(t).toBeInstanceOf(Target);
        expect(t.ssh).toBe('eva@xyz');
        expect(t.user).toBe('eva');
        expect(t.host).toBe('xyz');
    });

    it('throws for invalid stored objects in static from', () => {
        expect(() => Target.from({})).toThrow(
            /Invalid stored target: expected property "ssh" of type string/,
        );
    });
});
