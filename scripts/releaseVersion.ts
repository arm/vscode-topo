type Version = { major: number; minor: number; patch: number };
type ReleaseBaseline = { current: Version; latest: Version; tag: string };

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

function formatVersion({ major, minor, patch }: Version): string {
    return `${major}.${minor}.${patch}`;
}

export function calculateVersionFromCommits(
    { current, latest, tag }: ReleaseBaseline,
    subjects: readonly string[],
    preRelease: boolean,
): string {
    const hasPrerelease = latest.minor % 2 !== 0;
    if (subjects.length === 0) {
        throw new Error(`No commits since ${tag}; nothing to release`);
    }

    // Keep one prerelease track; apply feature and major bumps at stable release.
    if (preRelease) {
        return formatVersion(
            current.minor % 2 !== 0
                ? { ...current, patch: current.patch + 1 }
                : { major: current.major, minor: current.minor + 1, patch: 0 },
        );
    }

    const headers = subjects.map((subject) =>
        /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\(.*\))?(!)?: [a-z].+$/.exec(
            subject,
        ),
    );
    const hasBreakingChanges = headers.some((header) => header?.[2] === '!');
    const hasFeatures = headers.some((header) => header?.[1] === 'feat');
    const hasFixes = headers.some((header) => header?.[1] === 'fix');

    if (!hasPrerelease && !hasBreakingChanges && !hasFeatures && !hasFixes) {
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

    // Stable releases use even minor versions and must exceed any prerelease.
    if (next.minor % 2 !== 0) {
        next.minor += 1;
        next.patch = 0;
    }
    if (
        hasPrerelease &&
        (next.major < latest.major ||
            (next.major === latest.major && next.minor < latest.minor))
    ) {
        next = { major: latest.major, minor: latest.minor + 1, patch: 0 };
    }
    return formatVersion(next);
}

// Tags must be reachable from HEAD and sorted by descending version.
export function getReleaseBaseline(
    tags: readonly string[],
    preRelease: boolean,
): ReleaseBaseline {
    const releaseTags = tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
    const latestTag = releaseTags[0];
    const tag = preRelease
        ? latestTag
        : releaseTags.find((tag) => /^v\d+\.\d*[02468]\.\d+$/.test(tag));
    const current = tag && parseVersion(tag.slice(1));
    const latest = latestTag && parseVersion(latestTag.slice(1));
    if (!tag || !current || !latest) {
        throw new Error(
            preRelease ? 'No release tag found' : 'No stable release tag found',
        );
    }

    return { current, latest, tag };
}
