import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

type Version = { major: number; minor: number; patch: number };
type Manifest = { name?: string; publisher?: string; version?: string };

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

function greaterThan(a: Version, b: Version) {
    if (a.major !== b.major) {
        return a.major > b.major;
    }

    if (a.minor !== b.minor) {
        return a.minor > b.minor;
    }

    return a.patch > b.patch;
}

const getLatestPrereleaseVersion = (id: string): Version | undefined => {
    const r = spawnSync('npx', ['@vscode/vsce', 'show', id, '--json'], {
        encoding: 'utf8',
    });
    if (r.error || !r.stdout) {
        return undefined;
    }

    try {
        const data = JSON.parse(r.stdout) as {
            versions?: {
                version?: string;
                properties?: { key?: string; value?: string }[];
            }[];
        };
        const found = data.versions?.find((x) =>
            x.properties?.some(
                (p) =>
                    p.key === 'Microsoft.VisualStudio.Code.PreRelease' &&
                    p.value === 'true',
            ),
        )?.version;
        return found ? parseVersion(found) : undefined;
    } catch {
        return undefined;
    }
};

function git(...args: string[]): string {
    return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
    }).trim();
}

function calculateStableVersion(): string {
    // Only even-minor release tags reachable from HEAD are stable baselines.
    const tag = git('tag', '--merged', 'HEAD', '--sort=-version:refname')
        .split('\n')
        .find((tag) => /^v\d+\.\d*[02468]\.\d+$/.test(tag));
    const current = tag && parseVersion(tag.slice(1));
    if (!current) {
        throw new Error('No stable release tag found');
    }

    const messages = git(
        '-c',
        'log.showSignature=false',
        'log',
        `refs/tags/${tag}..HEAD`,
        '--no-decorate',
        '--no-color',
        '--format=%B%x00',
    )
        .split('\0')
        .map((message) => message.trim());
    const breaking = messages.some(
        (message) =>
            /^\w+(\(.*\))?!:/i.test(message) ||
            /\nBREAKING[ -]CHANGE:/.test(message),
    );

    if (breaking && (!keepMajorZero || current.major > 0)) {
        return formatVersion({ major: current.major + 1, minor: 0, patch: 0 });
    }
    if (
        breaking ||
        messages.some((message) => /^feat(\(.*\))?:/i.test(message))
    ) {
        return formatVersion({
            ...current,
            minor: current.minor + 2,
            patch: 0,
        });
    }
    if (messages.some((message) => /^fix(\(.*\))?:/i.test(message))) {
        return formatVersion({ ...current, patch: current.patch + 1 });
    }
    return '';
}

function calculateNewVersion(preRelease: boolean): string {
    if (!preRelease) {
        return calculateStableVersion();
    }

    const packageJson = join(process.cwd(), 'package.json');
    if (!existsSync(packageJson)) {
        throw new Error('package.json not found in the current directory');
    }

    const { name, publisher, version } = JSON.parse(
        readFileSync(packageJson, 'utf8'),
    ) as Manifest;
    if (!name || !publisher || !version) {
        throw new Error(
            'package.json must include name, publisher and version',
        );
    }

    const current = parseVersion(version);
    if (!current) {
        throw new Error('package.json version must use major.minor.patch');
    }

    const latest = getLatestPrereleaseVersion(`${publisher}.${name}`);
    if (latest && greaterThan(latest, current)) {
        return formatVersion({
            major: latest.major,
            minor: latest.minor,
            patch: latest.patch + 1,
        });
    }

    return formatVersion({
        major: current.major,
        minor: current.minor + (current.minor % 2 !== 0 ? 2 : 1),
        patch: 0,
    });
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
