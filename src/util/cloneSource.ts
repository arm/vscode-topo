import path from 'node:path';
import { WrappedError } from '../errors/wrappedError';

interface CloneRemoteSource {
    url: string;
    type: 'git';
}

interface CloneLocalSource {
    path: string;
    type: 'dir';
}

interface CloneRawSource {
    value: string;
    type?: never;
}

export type CloneSource = CloneRemoteSource | CloneLocalSource | CloneRawSource;

export type CloneParameters = Record<string, string>;

const invalidProjectNameMessage =
    'Project name must be a single folder name, not a path.';

const isGitUrl = (source: string): boolean =>
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    source.startsWith('https://') ||
    source.startsWith('http://') ||
    source.startsWith('git://');

export const parseCloneSource = (source: string): CloneSource => {
    if (isGitUrl(source)) {
        return { value: source };
    }

    const [sourceType, ...valueParts] = source.split(':');
    if (!sourceType || valueParts.length === 0) {
        throw new WrappedError('CLONE', `Invalid URL: ${source}`);
    }
    const value = valueParts.join(':');

    switch (sourceType) {
        case 'dir':
            return { type: 'dir', path: value };
        case 'git':
            return { type: 'git', url: value };
        default:
            throw new WrappedError('CLONE', `Invalid type: ${sourceType}`);
    }
};

export const validateProjectName = (
    projectName: string,
): string | undefined => {
    if (
        projectName === '.' ||
        projectName === '..' ||
        projectName.includes('/') ||
        projectName.includes('\\')
    ) {
        return invalidProjectNameMessage;
    }
    return undefined;
};

export const getDefaultProjectNameFromUrl = (url: string): string => {
    let pathname: string;
    const [urlWithoutFragment] = url.split('#');
    // Support scp-like SSH URLs (e.g. git@host:owner/repo.git).
    const scpMatch = urlWithoutFragment.match(/^(?:[^@]+@)?[^:]+:(.+)$/);
    if (scpMatch) {
        pathname = scpMatch[1];
    } else {
        try {
            pathname = new URL(urlWithoutFragment).pathname;
        } catch {
            throw new WrappedError('CLONE', `Invalid URL: ${url}`);
        }
    }

    const projectName = pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/\.git$/, '');
    if (!projectName) {
        throw new WrappedError('CLONE', `Invalid URL: ${url}`);
    }
    return projectName;
};

export const getDefaultProjectName = (source: CloneSource): string => {
    switch (source.type) {
        case 'dir':
            return path.basename(source.path);
        case 'git':
            return getDefaultProjectNameFromUrl(source.url);
        case undefined:
            return getDefaultProjectNameFromUrl(source.value);
    }
};

const getCloneSourceArgument = (source: CloneSource): string => {
    switch (source.type) {
        case 'dir':
            return `dir:${source.path}`;
        case 'git':
            return `git:${source.url}`;
        case undefined:
            return source.value;
    }
};

export const buildCloneArguments = (
    source: CloneSource,
    repositoryPath: string,
    parameters: CloneParameters = {},
): string[] => [
    'clone',
    getCloneSourceArgument(source),
    repositoryPath,
    ...Object.entries(parameters).map(([key, value]) => `${key}=${value}`),
];
