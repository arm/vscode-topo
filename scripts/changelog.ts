import { spawnSync } from 'node:child_process';

type ChangelogGroups = {
    breakingChanges: string[];
    newFeatures: string[];
    fixes: string[];
};

const emptyGroups = (): ChangelogGroups => ({
    breakingChanges: [],
    newFeatures: [],
    fixes: [],
});

export function formatChangelogEntry(commitSubjects: string[]): string {
    const groups = groupConventionalCommitSubjects(commitSubjects);
    const sections = [
        formatSection('Breaking changes', groups.breakingChanges),
        formatSection('New features', groups.newFeatures),
        formatSection('Fixes', groups.fixes),
    ].filter((section) => section.length > 0);

    if (sections.length === 0) {
        return 'No user-facing changes.\n';
    }

    return `${sections.join('\n\n')}\n`;
}

export function getCommitSubjectsSinceLastTag(): string[] {
    const latestTag = getLatestReachableTag();
    const logArguments = latestTag
        ? ['log', '--format=%s', `${latestTag}..HEAD`]
        : ['log', '--format=%s'];

    return runGit(logArguments)
        .split('\n')
        .map((subject) => subject.trim())
        .filter((subject) => subject.length > 0);
}

function groupConventionalCommitSubjects(
    commitSubjects: string[],
): ChangelogGroups {
    return commitSubjects.reduce((groups, subject) => {
        const parsed = parseConventionalCommitSubject(subject);
        if (!parsed) {
            return groups;
        }

        if (parsed.isBreaking) {
            groups.breakingChanges.push(parsed.description);
        } else if (parsed.type === 'feat') {
            groups.newFeatures.push(parsed.description);
        } else if (parsed.type === 'fix') {
            groups.fixes.push(parsed.description);
        }

        return groups;
    }, emptyGroups());
}

function parseConventionalCommitSubject(
    subject: string,
): { type: string; isBreaking: boolean; description: string } | undefined {
    const match =
        /^(?<type>[a-z]+)(?:\([^)]+\))?(?<breaking>!)?:\s*(?<description>.+)$/.exec(
            subject,
        );

    if (!match?.groups) {
        return undefined;
    }

    return {
        type: match.groups.type,
        isBreaking: match.groups.breaking === '!',
        description: match.groups.description.trim(),
    };
}

function formatSection(title: string, entries: string[]): string {
    if (entries.length === 0) {
        return '';
    }

    const bullets = entries.map((entry) => `- ${entry}`).join('\n');
    return `### ${title}\n\n${bullets}`;
}

function getLatestReachableTag(): string | undefined {
    const result = spawnSync('git', ['describe', '--tags', '--abbrev=0'], {
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        return undefined;
    }

    return result.stdout.trim() || undefined;
}

function runGit(arguments_: string[]): string {
    const result = spawnSync('git', arguments_, { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || 'Failed to run git');
    }

    return result.stdout;
}
