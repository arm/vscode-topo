import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

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

function getStableVersion(action: 'current' | 'next'): Version {
    const output = execFileSync(
        'go',
        [
            'run',
            'github.com/caarlos0/svu/v3@v3.4.0',
            action,
            '--json',
            '--tag.pattern',
            'v*.*[02468].*',
            '--tag.mode',
            'current',
            ...(action === 'next' ? ['--v0'] : []),
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );
    return JSON.parse(output) as Version;
}

function calculateNewVersion(preRelease: boolean): string {
    if (!preRelease) {
        const current = getStableVersion('current');
        const next = getStableVersion('next');
        if (!greaterThan(next, current)) {
            return '';
        }
        // Reserve odd minor versions for prereleases.
        if (next.minor % 2 !== 0) {
            next.minor += 1;
        }
        return formatVersion(next);
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
