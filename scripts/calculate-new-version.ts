import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

type Version = { major: number; minor: number; patch: number };
type Manifest = { version?: string };

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

function git(...args: string[]): string {
    return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
    }).trim();
}

function calculateVersion(
    current: Version,
    tag: string,
    preRelease: boolean,
): string {
    const range = `refs/tags/${tag}..HEAD`;
    if (git('rev-list', '--count', range) === '0') {
        throw new Error(`No commits since ${tag}; nothing to release`);
    }

    const subjects = git(
        '-c',
        'log.showSignature=false',
        'log',
        range,
        '--no-decorate',
        '--no-color',
        '--format=%s%x00',
    )
        .split('\0')
        .map((subject) => subject.trim())
        .filter(Boolean);
    const hasBreakingChanges = subjects.some((subject) =>
        /\w+(\(.*\))?!:/i.test(subject),
    );
    const hasFeatures = subjects.some((subject) =>
        /^feat(\(.*\))?:/i.test(subject),
    );
    const hasFixes = subjects.some((subject) =>
        /^fix(\(.*\))?:/i.test(subject),
    );

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

function calculateStableVersion(): string {
    // Only even-minor release tags reachable from HEAD are stable baselines.
    const tag = git('tag', '--merged', 'HEAD', '--sort=-version:refname')
        .split('\n')
        .find((tag) => /^v\d+\.\d*[02468]\.\d+$/.test(tag));
    const current = tag && parseVersion(tag.slice(1));
    if (!tag || !current) {
        throw new Error('No stable release tag found');
    }

    return calculateVersion(current, tag, false);
}

function calculateNewVersion(preRelease: boolean): string {
    if (!preRelease) {
        return calculateStableVersion();
    }

    const packageJson = join(process.cwd(), 'package.json');
    if (!existsSync(packageJson)) {
        throw new Error('package.json not found in the current directory');
    }

    const { version } = JSON.parse(
        readFileSync(packageJson, 'utf8'),
    ) as Manifest;
    if (!version) {
        throw new Error('package.json must include version');
    }

    const current = parseVersion(version);
    if (!current) {
        throw new Error('package.json version must use major.minor.patch');
    }

    return calculateVersion(current, `v${formatVersion(current)}`, true);
}

try {
    const newVersion = calculateNewVersion(
        process.argv.includes('--pre-release'),
    );
    console.log(newVersion);
} catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
}
