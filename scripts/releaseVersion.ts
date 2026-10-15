type Version = { major: number; minor: number; patch: number };

// Like svu --v0, keep breaking changes on 0.x. Set to false to allow a major bump.
const keepMajorZero = true;

function parseVersion(v: string): Version | undefined {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());

    if (m?.length !== 4) {
        return undefined;
    }

    const [_, major, minor, patch] = m.map(Number);
    return { major, minor, patch };
}

function formatVersion({ major, minor, patch }: Version) {
    return `${major}.${minor}.${patch}`;
}

export function calculateVersionFromCommits(
    current: Version,
    tag: string,
    subjects: readonly string[],
    preRelease: boolean,
): string {
    if (subjects.length === 0) {
        throw new Error(`No commits since ${tag}; nothing to release`);
    }

    const headers = subjects.map((subject) =>
        /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\(.*\))?(!)?: [a-z].+$/.exec(
            subject,
        ),
    );
    const hasBreakingChanges = headers.some((header) => header?.[2] === '!');
    const hasFeatures = headers.some((header) => header?.[1] === 'feat');
    const hasFixes = headers.some((header) => header?.[1] === 'fix');

    // Explicit prereleases also allow changes such as chores and refactors.
    if (!preRelease && !hasBreakingChanges && !hasFeatures && !hasFixes) {
        throw new Error(
            `Commits since ${tag} do not warrant a stable version bump`,
        );
    }

    let next: Version;
    if (hasBreakingChanges && (!keepMajorZero || current.major > 0)) {
        next = { major: current.major + 1, minor: 0, patch: 0 };
    } else if (hasBreakingChanges || hasFeatures) {
        next = {
            ...current,
            minor: current.minor + 1,
            patch: 0,
        };
    } else {
        next = { ...current, patch: current.patch + 1 };
    }

    // Reserve odd minor versions for prereleases and even ones for stable releases.
    if (next.minor % 2 !== (preRelease ? 1 : 0)) {
        next.minor += 1;
        next.patch = 0;
    }
    return formatVersion(next);
}

// Tags must be reachable from HEAD and sorted by descending version.
export function getReleaseBaseline(
    tags: readonly string[],
    preRelease: boolean,
) {
    // Prereleases use any release tag; stable releases use only even-minor tags.
    const tagRegex = preRelease
        ? /^v\d+\.\d+\.\d+$/
        : /^v\d+\.\d*[02468]\.\d+$/;
    const tag = tags.find((tag) => tagRegex.test(tag));
    const current = tag && parseVersion(tag.slice(1));
    if (!tag || !current) {
        throw new Error(
            preRelease ? 'No release tag found' : 'No stable release tag found',
        );
    }

    return { current, tag };
}
