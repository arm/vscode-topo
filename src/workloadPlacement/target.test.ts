import { Target } from './target';

describe('Target', () => {

    it('parses user and host from user@host', () => {
        const t = new Target('id1', 'alice@example.com');
        expect(t.user).toBe('alice');
        expect(t.host).toBe('example.com');
    });

    it('handles host-only ssh (no user)', () => {
        const t = new Target('id2', 'example.com');
        expect(t.user).toBeUndefined();
        expect(t.host).toBe('example.com');
    });

    it('accepts values with surrounding whitespace and parses from trimmed ssh', () => {
        const t = new Target(' id3 ', '  bob@host.com  ');
        expect(t.id).toBe('id3');
        expect(t.ssh).toBe('bob@host.com');
        expect(t.user).toBe('bob');
        expect(t.host).toBe('host.com');
    });

    it('returns stored id, ssh and name via toJSON', () => {
        const t = new Target('id4', 'carol@domain');
        const json = t.toJSON();
        expect(json).toEqual({ id: 'id4', ssh: 'carol@domain' });
    });

    it('throws for empty id or ssh in constructor', () => {
        expect(() => new Target('', 'host')).toThrow(/Target id must be a non-empty string/);
        expect(() => new Target('id', '')).toThrow(/Target ssh must be a non-empty string/);
    });

    it('throws when ssh contains user but missing host', () => {
        expect(() => new Target('id5', 'user@')).toThrow(/missing host in SSH target/);
    });

    it('returns the same instance when passed to static from', () => {
        const original = new Target('id6', 'dave@abc');
        const result = Target.from(original);
        expect(result).toBe(original);
    });

    it('recreates Target from plain object and validates inputs', () => {
        const obj = { id: 'id7', ssh: 'eva@xyz', name: 'label' };
        const t = Target.from(obj);
        expect(t).toBeInstanceOf(Target);
        expect(t.id).toBe('id7');
        expect(t.ssh).toBe('eva@xyz');
        expect(t.user).toBe('eva');
        expect(t.host).toBe('xyz');
    });

    it('throws for invalid stored objects in static from', () => {
        expect(() => Target.from({})).toThrow(/Invalid stored target: missing id/);
        expect(() => Target.from({ id: 'x' })).toThrow(/Invalid stored target: missing ssh/);
    });
});
