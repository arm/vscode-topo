import { execFileSync } from 'node:child_process';
import {
    calculateVersionFromCommits,
    getReleaseBaseline,
} from './releaseVersion.ts';

function git(...args: string[]): string {
    return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
    }).trim();
}

function getNextReleaseVersion(preRelease: boolean): string {
    const tags = git(
        'tag',
        '--merged',
        'HEAD',
        '--sort=-version:refname',
    ).split('\n');
    const baseline = getReleaseBaseline(tags, preRelease);
    const subjects = git(
        '-c',
        'log.showSignature=false',
        'log',
        `refs/tags/${baseline.tag}..HEAD`,
        '--no-decorate',
        '--no-color',
        '--format=%s%x00',
    )
        .split('\0')
        .map((subject) => subject.trim())
        .filter(Boolean);

    return calculateVersionFromCommits(baseline, subjects, preRelease);
}

try {
    const newVersion = getNextReleaseVersion(
        process.argv.includes('--pre-release'),
    );
    console.log(newVersion);
} catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
}
