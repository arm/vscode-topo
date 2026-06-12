import { formatChangelogEntry } from './changelog';

describe('formatChangelogEntry', () => {
    it('groups user-facing conventional commits and removes their markers', () => {
        expect(
            formatChangelogEntry([
                'feat!: remove deprecated target schema',
                'feat(target): show dependency health',
                'fix: handle missing containers',
                'chore: update dependencies',
                'ci: pin workflow actions',
            ]),
        ).toBe(
            [
                '### Breaking changes',
                '',
                '- remove deprecated target schema',
                '',
                '### New features',
                '',
                '- show dependency health',
                '',
                '### Fixes',
                '',
                '- handle missing containers',
                '',
            ].join('\n'),
        );
    });

    it('supports scoped breaking feature commits', () => {
        expect(
            formatChangelogEntry(['feat(cli)!: change clone arguments']),
        ).toBe(
            ['### Breaking changes', '', '- change clone arguments', ''].join(
                '\n',
            ),
        );
    });

    it('includes any breaking conventional commit in breaking changes', () => {
        expect(
            formatChangelogEntry([
                'fix!: reject unsupported target files',
                'refactor(cli)!: change project description schema',
                'chore!: drop support for old configuration',
            ]),
        ).toBe(
            [
                '### Breaking changes',
                '',
                '- reject unsupported target files',
                '- change project description schema',
                '- drop support for old configuration',
                '',
            ].join('\n'),
        );
    });

    it('omits empty groups', () => {
        expect(formatChangelogEntry(['fix(host): report SSH errors'])).toBe(
            ['### Fixes', '', '- report SSH errors', ''].join('\n'),
        );
    });

    it('falls back when there are no user-facing commits', () => {
        expect(
            formatChangelogEntry([
                'chore: update dependencies',
                'ci: pin workflow actions',
                'docs: update README',
            ]),
        ).toBe('No user-facing changes.\n');
    });
});
