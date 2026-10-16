import {
    calculateVersionFromCommits,
    getReleaseBaseline,
} from './releaseVersion';

describe('getReleaseBaseline', () => {
    const tags = [
        'unrelated-tag',
        'v9.0.0-rc.1',
        'v0.23.1',
        'v0.20.2',
        'v0.20.1',
    ];

    it('selects the latest release tag, including prereleases', () => {
        expect(getReleaseBaseline(tags, true)).toEqual({
            tag: 'v0.23.1',
            current: { major: 0, minor: 23, patch: 1 },
            latest: { major: 0, minor: 23, patch: 1 },
        });
    });

    it('uses the last stable tag while retaining the latest prerelease', () => {
        expect(getReleaseBaseline(tags, false)).toEqual({
            tag: 'v0.20.2',
            current: { major: 0, minor: 20, patch: 2 },
            latest: { major: 0, minor: 23, patch: 1 },
        });
    });

    it('uses a stable tag when it is the latest release', () => {
        expect(getReleaseBaseline(['v1.10.0', 'v1.9.3'], true)).toEqual({
            tag: 'v1.10.0',
            current: { major: 1, minor: 10, patch: 0 },
            latest: { major: 1, minor: 10, patch: 0 },
        });
    });

    it('rejects missing release tags', () => {
        expect(() => getReleaseBaseline([], true)).toThrow(
            'No release tag found',
        );
    });

    it('requires a stable baseline for stable releases', () => {
        expect(() => getReleaseBaseline(['v1.5.0'], false)).toThrow(
            'No stable release tag found',
        );
    });
});

describe('calculateVersionFromCommits', () => {
    it.each([
        ['v0.20.3', 'fix(target): repair target', false, '0.20.4'],
        ['v0.20.3', 'feat(target): add target', false, '0.22.0'],
        ['v0.20.3', 'refactor!: replace target API', false, '0.22.0'],
        ['v0.21.3', 'feat: add target', true, '0.21.4'],
        ['v1.4.3', 'refactor(target)!: replace target API', false, '2.0.0'],
        ['v1.4.3', 'refactor!: replace target API', true, '1.5.0'],
        ['v1.5.3', 'refactor!: replace target API', true, '1.5.4'],
        ['v1.5.3', 'refactor: tidy code', true, '1.5.4'],
    ])(
        '%s + %s with preRelease=%s becomes %s',
        (tag, subject, preRelease, expected) => {
            const baseline = getReleaseBaseline([tag], preRelease);

            expect(
                calculateVersionFromCommits(baseline, [subject], preRelease),
            ).toBe(expected);
        },
    );

    const baseline = getReleaseBaseline(['v1.4.3'], false);

    it.each([
        [
            [
                'fix: repair target',
                'feat: add target',
                'fix: repair another target',
            ],
            '1.6.0',
        ],
        [
            ['feat: add target', 'chore!: change API', 'fix: repair target'],
            '2.0.0',
        ],
    ])('uses the largest bump in %j', (subjects, expected) => {
        expect(calculateVersionFromCommits(baseline, subjects, false)).toBe(
            expected,
        );
    });

    it('rejects stable releases without version-bumping commits', () => {
        expect(() =>
            calculateVersionFromCommits(
                baseline,
                [
                    'chore: update dependencies',
                    'docs: describe feat: and fix: prefixes',
                    'docs: describe refactor!: syntax',
                ],
                false,
            ),
        ).toThrow('Commits since v1.4.3 do not warrant a stable version bump');
    });

    it('ignores commit titles rejected by PR title lint', () => {
        expect(() =>
            calculateVersionFromCommits(
                baseline,
                [
                    'Merge pull request: refactor(target)!: replace target API',
                    'FEAT(target): add target',
                    'feat: Add target',
                    'feat:add target',
                    'unknown!: replace target API',
                ],
                false,
            ),
        ).toThrow('Commits since v1.4.3 do not warrant a stable version bump');
    });

    it.each([
        ['fix: repair target', '1.6.0'],
        ['feat: add target', '1.6.0'],
        ['chore: update dependencies', '1.6.0'],
        ['refactor!: replace target API', '2.0.0'],
    ])('promotes a prerelease containing %s to %s', (subject, expected) => {
        const baseline = getReleaseBaseline(
            ['v1.5.1', 'v1.5.0', 'v1.4.1'],
            false,
        );

        expect(calculateVersionFromCommits(baseline, [subject], false)).toBe(
            expected,
        );
    });

    it('rejects an empty commit range', () => {
        expect(() => calculateVersionFromCommits(baseline, [], false)).toThrow(
            'No commits since v1.4.3; nothing to release',
        );
    });
});
