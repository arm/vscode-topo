import { parseCloneSourceString } from './parseSourceCloneString';

describe('parseCloneSourceString', () => {
    it('parses git clone sources', () => {
        expect(
            parseCloneSourceString(
                'git:https://example.com/virtual-bittermelon-peeler.git',
            ),
        ).toEqual({
            type: 'git',
            url: 'https://example.com/virtual-bittermelon-peeler.git',
        });
    });

    it('parses dir clone sources', () => {
        expect(parseCloneSourceString('dir:/tmp/project')).toEqual({
            type: 'dir',
            path: '/tmp/project',
        });
    });

    it('returns raw clone sources when no explicit type is provided', () => {
        expect(
            parseCloneSourceString(
                'https://example.com/virtual-bittermelon-peeler.git',
            ),
        ).toEqual({
            value: 'https://example.com/virtual-bittermelon-peeler.git',
        });
        expect(
            parseCloneSourceString(
                'ssh://example.com/virtual-bittermelon-peeler.git',
            ),
        ).toEqual({
            value: 'ssh://example.com/virtual-bittermelon-peeler.git',
        });
        expect(
            parseCloneSourceString(
                'git@example.com:virtual-bittermelon-peeler.git',
            ),
        ).toEqual({
            value: 'git@example.com:virtual-bittermelon-peeler.git',
        });
    });

    it('throws a clone error for invalid explicit types wrapping a URL', () => {
        expect(() =>
            parseCloneSourceString(
                'invalid:https://example.com/virtual-bittermelon-peeler.git',
            ),
        ).toThrow(
            expect.objectContaining({
                code: 'CLONE',
                message: 'Invalid type: invalid',
            }),
        );
        expect(() =>
            parseCloneSourceString(
                'invalid:ssh://example.com/virtual-bittermelon-peeler.git',
            ),
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
        expect(() => parseCloneSourceString('archive:hello-world')).toThrow(
            expect.objectContaining({
                code: 'CLONE',
                message: 'Invalid type: archive',
            }),
        );
    });
});
