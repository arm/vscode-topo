import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

type Version = { major: number; minor: number; patch: number };
type Manifest = { name?: string; publisher?: string; version?: string };

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

function calculateNewVersion(releaseType: string): string {
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

    const oddMinor = current.minor % 2 !== 0;
    const preFallback = formatVersion({
        major: current.major,
        minor: oddMinor ? current.minor + 2 : current.minor + 1,
        patch: 0,
    });

    let next: string;
    if (releaseType === 'Major') {
        next = formatVersion({ major: current.major + 1, minor: 0, patch: 0 });
    } else if (releaseType === 'Minor') {
        next = formatVersion({
            major: current.major,
            minor: oddMinor ? current.minor + 1 : current.minor + 2,
            patch: 0,
        });
    } else if (releaseType === 'Patch') {
        next = formatVersion({
            major: current.major,
            minor: current.minor,
            patch: current.patch + 1,
        });
    } else if (releaseType === 'Pre-release') {
        const latest = getLatestPrereleaseVersion(`${publisher}.${name}`);
        if (latest && greaterThan(latest, current)) {
            next = formatVersion({
                major: latest.major,
                minor: latest.minor,
                patch: latest.patch + 1,
            });
        } else {
            next = preFallback;
        }
    } else if (releaseType === 'None') {
        next = '';
    } else {
        throw new Error(`Unknown release type: ${releaseType}`);
    }

    return next;
}

try {
    const newVersion = calculateNewVersion(process.env.RELEASE_TYPE || 'None');
    console.log(newVersion);
} catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
}
