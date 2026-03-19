import { parseCloneSourceString } from './parseSourceCloneString';

describe('parseCloneSourceString', () => {
    it('parses git clone sources', () => {
        expect(
            parseCloneSourceString('git:https://example.com/repo.git'),
        ).toEqual({
            type: 'git',
            url: 'https://example.com/repo.git',
        });
    });

    it('parses template clone sources', () => {
        expect(parseCloneSourceString('template:hello-world')).toEqual({
            type: 'template',
            template: 'hello-world',
        });
    });

    it('parses dir clone sources', () => {
        expect(parseCloneSourceString('dir:/tmp/project')).toEqual({
            type: 'dir',
            path: '/tmp/project',
        });
    });

    it('returns raw clone sources when no explicit type is provided', () => {
        expect(parseCloneSourceString('https://example.com/repo.git')).toEqual({
            value: 'https://example.com/repo.git',
        });
        expect(parseCloneSourceString('ssh://example.com/repo.git')).toEqual({
            value: 'ssh://example.com/repo.git',
        });
        expect(parseCloneSourceString('git@example.com:repo.git')).toEqual({
            value: 'git@example.com:repo.git',
        });
    });

    it('throws a clone error for invalid explicit types wrapping a URL', () => {
        expect(() =>
            parseCloneSourceString('invalid:https://example.com/repo.git'),
        ).toThrow(
            expect.objectContaining({
                code: 'CLONE',
                message: 'Invalid type: invalid',
            }),
        );
        expect(() =>
            parseCloneSourceString('invalid:ssh://example.com/repo.git'),
        ).toThrow(
            expect.objectContaining({
                code: 'CLONE',
                message: 'Invalid type: invalid',
            }),
        );
    });

    it('throws a clone error for invalid clone source strings', () => {
        expect(() => parseCloneSourceString('not-a-valid-url')).toThrow(
            expect.objectContaining({
                code: 'CLONE',
                message: 'Invalid URL: not-a-valid-url',
            }),
        );
        expect(() => parseCloneSourceString('foo:bar')).toThrow(
            expect.objectContaining({
                code: 'CLONE',
                message: 'Invalid type: foo',
            }),
        );
    });
});
