import {
    formatChangelogEntry,
    getCommitSubjectsSinceLastTag,
} from './changelog.ts';

try {
    process.stdout.write(formatChangelogEntry(getCommitSubjectsSinceLastTag()));
} catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
}
